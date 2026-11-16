import { prisma } from '@/lib/prisma';
import { BusinessRuleError } from '@/lib/errors';
import {
  calculateExchangeSummary,
  calculateWarrantyEndDate,
  validateStockDeduction,
} from '@/lib/domain/calculations';
import { recordAuditLog } from '@/lib/services/audit';
import { syncSerializedProductStock } from '@/lib/services/inventory';
import { withTransactionRetry } from '@/lib/services/tx-retry';
import type { Prisma, ReturnReason, RestockStatus } from '@prisma/client';

// A refund can never exceed what the customer actually paid for the units being
// returned (line total, prorated by quantity). Prevents cash/books destruction.
function assertRefundWithinPaidAmount(
  refundAmount: number,
  lineTotalAmount: number,
  lineQuantity: number,
  returnQuantity: number,
  productName: string
): void {
  const perUnitPaid = lineQuantity > 0 ? lineTotalAmount / lineQuantity : 0;
  const maxRefund = perUnitPaid * returnQuantity;
  if (refundAmount > maxRefund + 0.005) {
    throw new BusinessRuleError(
      `Refund for ${productName} cannot exceed Rs ${maxRefund.toFixed(2)} paid for ${returnQuantity} unit(s).`
    );
  }
}

async function generateReturnNumber(tx: Prisma.TransactionClient, prefix: string): Promise<string> {
  const count = await tx.return.count();
  const last = await tx.return.findFirst({
    where: { returnNumber: { startsWith: prefix } },
    orderBy: { returnNumber: 'desc' },
    select: { returnNumber: true },
  });
  const lastSeq = last ? parseInt(last.returnNumber.slice(prefix.length), 10) : NaN;
  let seq = Number.isFinite(lastSeq) ? Math.max(1001 + count, lastSeq + 1) : 1001 + count;
  while (true) {
    const candidate = `${prefix}${seq}`;
    const exists = await tx.return.findUnique({ where: { returnNumber: candidate }, select: { id: true } });
    if (!exists) return candidate;
    seq += 1;
  }
}

export async function createReturn(
  input: {
    originalSaleId: string;
    returnDate: string;
    reason: ReturnReason;
    notes?: string | null;
    items: Array<{
      saleItemId: string;
      quantity: number;
      restockStatus: RestockStatus;
      condition?: string | null;
      refundAmount: number;
    }>;
  },
  adminUserId: string
) {
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: input.originalSaleId },
      include: {
        items: { include: { product: true, serializedItem: true } },
      },
    });
    if (!sale) throw new BusinessRuleError('Original sale invoice not found.', 404);
    if (sale.status === 'CANCELLED') {
      throw new BusinessRuleError('Cannot process a return on a cancelled invoice.');
    }

    const returnDate = new Date(input.returnDate);
    if (Number.isNaN(returnDate.getTime())) {
      throw new BusinessRuleError('Invalid return date.');
    }
    const saleItemMap = new Map(sale.items.map((si) => [si.id, si]));

    let totalRefund = 0;
    let totalProfitAdjustment = 0;

    const preparedItems: Array<{
      saleItemId: string;
      productId: string;
      serializedItemId: string | null;
      quantity: number;
      restockStatus: RestockStatus;
      condition: string | null;
      refundAmount: number;
      costAmount: number;
      productName: string;
      inventoryType: 'SERIALIZED' | 'QUANTITY';
    }> = [];

    for (const reqItem of input.items) {
      const si = saleItemMap.get(reqItem.saleItemId);
      if (!si) {
        throw new BusinessRuleError('Selected sale line item does not belong to this invoice.');
      }
      const remainingReturnable = si.quantity - si.returnedQuantity;
      if (reqItem.quantity > remainingReturnable) {
        throw new BusinessRuleError(
          `Cannot return ${reqItem.quantity} of ${si.product.name}; only ${remainingReturnable} left returnable.`
        );
      }
      assertRefundWithinPaidAmount(
        reqItem.refundAmount,
        si.totalAmount,
        si.quantity,
        reqItem.quantity,
        si.product.name
      );

      const costAmount = si.unitCost * reqItem.quantity;
      const isRestocked = reqItem.restockStatus === 'RESTOCKED';
      // Refund reduces revenue (-refundAmount); restocking recovers COGS (+costAmount)
      const itemProfitAdj = isRestocked ? costAmount - reqItem.refundAmount : -reqItem.refundAmount;

      totalRefund += reqItem.refundAmount;
      totalProfitAdjustment += itemProfitAdj;

      preparedItems.push({
        saleItemId: si.id,
        productId: si.productId,
        serializedItemId: si.serializedItemId,
        quantity: reqItem.quantity,
        restockStatus: reqItem.restockStatus,
        condition: reqItem.condition || null,
        refundAmount: reqItem.refundAmount,
        costAmount,
        productName: si.product.name,
        inventoryType: si.product.inventoryType,
      });
    }

    const returnNumber = await generateReturnNumber(tx, 'TE-RET-');
    const returnRecord = await tx.return.create({
      data: {
        returnNumber,
        originalSaleId: sale.id,
        customerId: sale.customerId,
        returnDate,
        type: 'RETURN',
        reason: input.reason,
        refundAmount: totalRefund,
        priceDifference: -totalRefund,
        profitAdjustment: totalProfitAdjustment,
        notes: input.notes || null,
      },
    });

    for (const item of preparedItems) {
      await tx.returnItem.create({
        data: {
          returnId: returnRecord.id,
          saleItemId: item.saleItemId,
          productId: item.productId,
          serializedItemId: item.serializedItemId,
          quantity: item.quantity,
          restockStatus: item.restockStatus,
          condition: item.condition,
          refundAmount: item.refundAmount,
          costAmount: item.costAmount,
        },
      });

      await tx.saleItem.update({
        where: { id: item.saleItemId },
        data: { returnedQuantity: { increment: item.quantity } },
      });

      // Void active warranties for returned item
      await tx.warranty.updateMany({
        where: { saleItemId: item.saleItemId, status: 'ACTIVE' },
        data: { status: 'VOID' },
      });

      const freshProduct = await tx.product.findUnique({ where: { id: item.productId } });
      const previousStock = freshProduct?.currentStock ?? 0;

      if (item.inventoryType === 'SERIALIZED' && item.serializedItemId) {
        const nextSerialStatus = item.restockStatus === 'RESTOCKED' ? 'IN_STOCK' : 'RETURNED_DEFECTIVE';
        await tx.serializedInventoryItem.update({
          where: { id: item.serializedItemId },
          data: { stockStatus: nextSerialStatus },
        });
        const newStock = await syncSerializedProductStock(tx, item.productId);
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            serializedItemId: item.serializedItemId,
            movementType: item.restockStatus === 'RESTOCKED' ? 'SALE_RETURN' : 'DAMAGED',
            quantity: 1,
            referenceType: 'RETURN',
            referenceId: returnRecord.id,
            previousStock,
            newStock,
            reason: `Return ${returnNumber} (${item.restockStatus})`,
            createdAt: returnDate,
          },
        });
      } else {
        if (item.restockStatus === 'RESTOCKED') {
          const newStock = previousStock + item.quantity;
          await tx.product.update({
            where: { id: item.productId },
            data: { currentStock: newStock },
          });
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              movementType: 'SALE_RETURN',
              quantity: item.quantity,
              referenceType: 'RETURN',
              referenceId: returnRecord.id,
              previousStock,
              newStock,
              reason: `Return ${returnNumber} (Restocked)`,
              createdAt: returnDate,
            },
          });
        } else {
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              movementType: 'DAMAGED',
              quantity: item.quantity,
              referenceType: 'RETURN',
              referenceId: returnRecord.id,
              previousStock,
              newStock: previousStock,
              reason: `Return ${returnNumber} (Damaged - not restocked)`,
              createdAt: returnDate,
            },
          });
        }
      }
    }

    // Recompute sale status
    const updatedSaleItems = await tx.saleItem.findMany({ where: { saleId: sale.id } });
    const allReturned = updatedSaleItems.every((i) => i.returnedQuantity >= i.quantity);
    await tx.sale.update({
      where: { id: sale.id },
      data: { status: allReturned ? 'RETURNED' : 'PARTIAL_RETURN' },
    });

    await recordAuditLog(tx, {
      entityType: 'Return',
      entityId: returnRecord.id,
      action: 'CREATE',
      updatedData: { returnNumber, totalRefund, profitAdjustment: totalProfitAdjustment },
      adminUserId,
    });

    return returnRecord;
  }));
}

export async function createExchange(
  input: {
    originalSaleId: string;
    returnDate: string;
    reason: ReturnReason;
    notes?: string | null;
    returnedItems: Array<{
      saleItemId: string;
      quantity: number;
      restockStatus: RestockStatus;
      condition?: string | null;
      refundAmount: number;
    }>;
    replacementItems: Array<{
      productId: string;
      serializedItemId?: string | null;
      quantity: number;
      unitPrice: number;
    }>;
  },
  adminUserId: string
) {
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id: input.originalSaleId },
      include: { items: { include: { product: true, serializedItem: true } } },
    });
    if (!sale) throw new BusinessRuleError('Original sale invoice not found.', 404);
    if (sale.status === 'CANCELLED') {
      throw new BusinessRuleError('Cannot process exchange on a cancelled invoice.');
    }

    const returnDate = new Date(input.returnDate);
    if (Number.isNaN(returnDate.getTime())) {
      throw new BusinessRuleError('Invalid return date.');
    }
    const saleItemMap = new Map(sale.items.map((si) => [si.id, si]));

    let returnedValue = 0;
    let returnedRecoveredCost = 0;
    let returnedTotalCost = 0;

    const preparedReturns: Array<{
      saleItemId: string;
      productId: string;
      serializedItemId: string | null;
      quantity: number;
      restockStatus: RestockStatus;
      condition: string | null;
      refundAmount: number;
      costAmount: number;
      inventoryType: 'SERIALIZED' | 'QUANTITY';
    }> = [];

    for (const reqRet of input.returnedItems) {
      const si = saleItemMap.get(reqRet.saleItemId);
      if (!si) throw new BusinessRuleError('Returned sale item not found in original invoice.');
      const remaining = si.quantity - si.returnedQuantity;
      if (reqRet.quantity > remaining) {
        throw new BusinessRuleError(`Cannot return more than ${remaining} of ${si.product.name}.`);
      }
      assertRefundWithinPaidAmount(
        reqRet.refundAmount,
        si.totalAmount,
        si.quantity,
        reqRet.quantity,
        si.product.name
      );

      const costAmount = si.unitCost * reqRet.quantity;
      returnedValue += reqRet.refundAmount;
      returnedTotalCost += costAmount;
      if (reqRet.restockStatus === 'RESTOCKED') {
        returnedRecoveredCost += costAmount;
      }

      preparedReturns.push({
        saleItemId: si.id,
        productId: si.productId,
        serializedItemId: si.serializedItemId,
        quantity: reqRet.quantity,
        restockStatus: reqRet.restockStatus,
        condition: reqRet.condition || null,
        refundAmount: reqRet.refundAmount,
        costAmount,
        inventoryType: si.product.inventoryType,
      });
    }

    // Validate replacement products & serials
    const repProductIds = Array.from(new Set(input.replacementItems.map((r) => r.productId)));
    const repSerialIds = input.replacementItems
      .map((r) => r.serializedItemId)
      .filter((id): id is string => Boolean(id));

    const [repProducts, repSerials] = await Promise.all([
      tx.product.findMany({ where: { id: { in: repProductIds } } }),
      repSerialIds.length > 0
        ? tx.serializedInventoryItem.findMany({ where: { id: { in: repSerialIds } } })
        : Promise.resolve([]),
    ]);

    const repProductMap = new Map(repProducts.map((p) => [p.id, p]));
    const repSerialMap = new Map(repSerials.map((s) => [s.id, s]));

    let replacementValue = 0;
    let replacementCost = 0;
    const preparedReplacements: Array<{
      productId: string;
      serializedItemId: string | null;
      quantity: number;
      unitPrice: number;
      unitCost: number;
      totalAmount: number;
      inventoryType: 'SERIALIZED' | 'QUANTITY';
    }> = [];

    for (const rep of input.replacementItems) {
      const product = repProductMap.get(rep.productId);
      if (!product) throw new BusinessRuleError('Replacement product not found.');

      let unitCost = product.purchasePrice;
      if (product.inventoryType === 'SERIALIZED') {
        if (!rep.serializedItemId || rep.quantity !== 1) {
          throw new BusinessRuleError(`Replacement ${product.name} requires a serial number with quantity 1.`);
        }
        const serial = repSerialMap.get(rep.serializedItemId);
        if (!serial || serial.productId !== product.id || serial.stockStatus !== 'IN_STOCK') {
          throw new BusinessRuleError(`Replacement serial number for ${product.name} is not in stock.`);
        }
        unitCost = serial.purchasePrice;
      } else {
        if (!validateStockDeduction(product.currentStock, rep.quantity)) {
          throw new BusinessRuleError(`Insufficient stock for replacement ${product.name}.`);
        }
      }

      const lineTotal = rep.quantity * rep.unitPrice;
      replacementValue += lineTotal;
      replacementCost += rep.quantity * unitCost;

      preparedReplacements.push({
        productId: product.id,
        serializedItemId: rep.serializedItemId || null,
        quantity: rep.quantity,
        unitPrice: rep.unitPrice,
        unitCost,
        totalAmount: lineTotal,
        inventoryType: product.inventoryType,
      });
    }

    const summary = calculateExchangeSummary({
      returnedValue,
      returnedCost: returnedTotalCost,
      restocked: returnedRecoveredCost > 0,
      replacementValue,
      replacementCost,
    });
    // Exact profit adjustment when mixed restocked/damaged items exist
    const exactProfitAdjustment =
      (replacementValue - replacementCost) - (returnedValue - returnedRecoveredCost);

    const returnNumber = await generateReturnNumber(tx, 'TE-EXC-');
    const exchangeRecord = await tx.return.create({
      data: {
        returnNumber,
        originalSaleId: sale.id,
        customerId: sale.customerId,
        returnDate,
        type: 'EXCHANGE',
        reason: input.reason,
        refundAmount: summary.refundAmount,
        priceDifference: summary.priceDifference,
        profitAdjustment: exactProfitAdjustment,
        notes: input.notes || null,
      },
    });

    // Apply returned items
    for (const ret of preparedReturns) {
      await tx.returnItem.create({
        data: {
          returnId: exchangeRecord.id,
          saleItemId: ret.saleItemId,
          productId: ret.productId,
          serializedItemId: ret.serializedItemId,
          quantity: ret.quantity,
          restockStatus: ret.restockStatus,
          condition: ret.condition,
          refundAmount: ret.refundAmount,
          costAmount: ret.costAmount,
        },
      });
      await tx.saleItem.update({
        where: { id: ret.saleItemId },
        data: { returnedQuantity: { increment: ret.quantity } },
      });
      await tx.warranty.updateMany({
        where: { saleItemId: ret.saleItemId, status: 'ACTIVE' },
        data: { status: 'VOID' },
      });

      const prod = await tx.product.findUnique({ where: { id: ret.productId } });
      const prevStock = prod?.currentStock ?? 0;

      if (ret.inventoryType === 'SERIALIZED' && ret.serializedItemId) {
        await tx.serializedInventoryItem.update({
          where: { id: ret.serializedItemId },
          data: { stockStatus: ret.restockStatus === 'RESTOCKED' ? 'IN_STOCK' : 'RETURNED_DEFECTIVE' },
        });
        const newStock = await syncSerializedProductStock(tx, ret.productId);
        await tx.stockMovement.create({
          data: {
            productId: ret.productId,
            serializedItemId: ret.serializedItemId,
            movementType: 'EXCHANGE_IN',
            quantity: 1,
            referenceType: 'EXCHANGE',
            referenceId: exchangeRecord.id,
            previousStock: prevStock,
            newStock,
            reason: `Exchange ${returnNumber} returned item`,
            createdAt: returnDate,
          },
        });
      } else if (ret.restockStatus === 'RESTOCKED') {
        const newStock = prevStock + ret.quantity;
        await tx.product.update({
          where: { id: ret.productId },
          data: { currentStock: newStock },
        });
        await tx.stockMovement.create({
          data: {
            productId: ret.productId,
            movementType: 'EXCHANGE_IN',
            quantity: ret.quantity,
            referenceType: 'EXCHANGE',
            referenceId: exchangeRecord.id,
            previousStock: prevStock,
            newStock,
            reason: `Exchange ${returnNumber} returned item`,
            createdAt: returnDate,
          },
        });
      }
    }

    // Apply replacement items
    const settings = await tx.shopSettings.findUnique({ where: { id: 'default' } });
    for (const rep of preparedReplacements) {
      await tx.exchangeReplacementItem.create({
        data: {
          returnId: exchangeRecord.id,
          productId: rep.productId,
          serializedItemId: rep.serializedItemId,
          quantity: rep.quantity,
          unitPrice: rep.unitPrice,
          unitCost: rep.unitCost,
          totalAmount: rep.totalAmount,
        },
      });

      const prod = await tx.product.findUnique({ where: { id: rep.productId } });
      const prevStock = prod?.currentStock ?? 0;

      if (rep.inventoryType === 'SERIALIZED' && rep.serializedItemId) {
        await tx.serializedInventoryItem.update({
          where: { id: rep.serializedItemId },
          data: { stockStatus: 'SOLD' },
        });
        const newStock = await syncSerializedProductStock(tx, rep.productId);
        await tx.stockMovement.create({
          data: {
            productId: rep.productId,
            serializedItemId: rep.serializedItemId,
            movementType: 'EXCHANGE_OUT',
            quantity: 1,
            referenceType: 'EXCHANGE',
            referenceId: exchangeRecord.id,
            previousStock: prevStock,
            newStock,
            reason: `Exchange ${returnNumber} replacement`,
            createdAt: returnDate,
          },
        });
      } else {
        const newStock = Math.max(0, prevStock - rep.quantity);
        await tx.product.update({
          where: { id: rep.productId },
          data: { currentStock: newStock },
        });
        await tx.stockMovement.create({
          data: {
            productId: rep.productId,
            movementType: 'EXCHANGE_OUT',
            quantity: rep.quantity,
            referenceType: 'EXCHANGE',
            referenceId: exchangeRecord.id,
            previousStock: prevStock,
            newStock,
            reason: `Exchange ${returnNumber} replacement`,
            createdAt: returnDate,
          },
        });
      }

      // Create 1-month default replacement warranty if serialized laptop/chromebook
      if (rep.inventoryType === 'SERIALIZED' && sale.items[0]) {
        const wEnd = calculateWarrantyEndDate(returnDate, 1);
        await tx.warranty.create({
          data: {
            saleId: sale.id,
            saleItemId: sale.items[0].id,
            customerId: sale.customerId,
            productId: rep.productId,
            serializedItemId: rep.serializedItemId,
            warrantyStart: returnDate,
            warrantyEnd: wEnd,
            durationMonths: 1,
            warrantyTerms: settings?.warrantyTerms || 'Replacement warranty',
            status: 'ACTIVE',
          },
        });
      }
    }

    await recordAuditLog(tx, {
      entityType: 'Exchange',
      entityId: exchangeRecord.id,
      action: 'CREATE',
      updatedData: {
        returnNumber,
        priceDifference: summary.priceDifference,
        profitAdjustment: exactProfitAdjustment,
      },
      adminUserId,
    });

    return exchangeRecord;
  }));
}
