import { prisma } from '@/lib/prisma';
import { BusinessRuleError } from '@/lib/api-utils';
import {
  calculateSaleTotals,
  calculateWarrantyEndDate,
  validateStockDeduction,
} from '@/lib/domain/calculations';
import { recordAuditLog } from '@/lib/services/audit';
import { syncSerializedProductStock } from '@/lib/services/inventory';
import { withTransactionRetry } from '@/lib/services/tx-retry';
import type { Prisma } from '@prisma/client';

export interface SaleItemInput {
  productId: string;
  serializedItemId?: string | null;
  quantity: number;
  unitPrice: number;
  discount: number;
  warrantyMonths: number;
}

export interface SalePayload {
  invoiceNumber?: string;
  customerId?: string | null;
  walkInCustomerName?: string | null;
  walkInCustomerPhone?: string | null;
  saleDate: string;
  discount: number;
  paymentMethod: 'CASH';
  notes?: string | null;
  items: SaleItemInput[];
}

async function generateUniqueInvoiceNumber(tx: Prisma.TransactionClient): Promise<string> {
  const settings = await tx.shopSettings.findUnique({ where: { id: 'default' } });
  const prefix = settings?.invoicePrefix || 'TE-INV-';
  const count = await tx.sale.count();
  const last = await tx.sale.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  });
  const lastSeq = last ? parseInt(last.invoiceNumber.slice(prefix.length), 10) : NaN;
  let seq = Number.isFinite(lastSeq) ? Math.max(1001 + count, lastSeq + 1) : 1001 + count;
  while (true) {
    const candidate = `${prefix}${seq}`;
    const exists = await tx.sale.findUnique({
      where: { invoiceNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    seq += 1;
  }
}

export async function createSale(input: SalePayload, adminUserId: string) {
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
    const saleDate = new Date(input.saleDate);
    if (Number.isNaN(saleDate.getTime())) {
      throw new BusinessRuleError('Invalid sale date.');
    }

    if (input.customerId) {
      const cust = await tx.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
      if (!cust) throw new BusinessRuleError('Selected customer does not exist.');
    }

    const settings = await tx.shopSettings.findUnique({ where: { id: 'default' } });
    const defaultWarrantyTerms = settings?.warrantyTerms || 'Standard Shop Checking Warranty';

    // Batch fetch products and serialized items to eliminate N+1 queries
    const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
    const serializedIds = input.items
      .map((i) => i.serializedItemId)
      .filter((id): id is string => Boolean(id));

    const [products, serializedItems] = await Promise.all([
      tx.product.findMany({ where: { id: { in: productIds } } }),
      serializedIds.length > 0
        ? tx.serializedInventoryItem.findMany({ where: { id: { in: serializedIds } } })
        : Promise.resolve([]),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const serialMap = new Map(serializedItems.map((s) => [s.id, s]));

    // Check duplicate serializedItemId in the same sale payload
    const seenSerialIds = new Set<string>();
    const quantityRequests = new Map<string, number>();

    const resolvedItems: Array<{
      input: SaleItemInput;
      unitCost: number;
      serialNumber?: string;
    }> = [];

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BusinessRuleError('One of the selected products was not found.');
      }

      if (product.inventoryType === 'SERIALIZED') {
        if (item.quantity !== 1) {
          throw new BusinessRuleError(`${product.name} is serialized and must have quantity 1 per line.`);
        }
        if (!item.serializedItemId) {
          throw new BusinessRuleError(`Please select a serial number for ${product.name}.`);
        }
        if (seenSerialIds.has(item.serializedItemId)) {
          throw new BusinessRuleError('Cannot sell the same serial number twice in one invoice.');
        }
        seenSerialIds.add(item.serializedItemId);

        const serialItem = serialMap.get(item.serializedItemId);
        if (!serialItem || serialItem.productId !== product.id) {
          throw new BusinessRuleError(`Invalid serial number selected for ${product.name}.`);
        }
        if (serialItem.stockStatus !== 'IN_STOCK') {
          throw new BusinessRuleError(
            `Serial number ${serialItem.serialNumber} is already ${serialItem.stockStatus.toLowerCase()} and cannot be sold.`
          );
        }

        resolvedItems.push({
          input: item,
          unitCost: serialItem.purchasePrice,
          serialNumber: serialItem.serialNumber,
        });
      } else {
        const accumulatedQty = (quantityRequests.get(product.id) ?? 0) + item.quantity;
        if (!validateStockDeduction(product.currentStock, accumulatedQty)) {
          throw new BusinessRuleError(
            `Insufficient stock for ${product.name}. Available: ${product.currentStock}, requested: ${accumulatedQty}.`
          );
        }
        quantityRequests.set(product.id, accumulatedQty);

        resolvedItems.push({
          input: item,
          unitCost: product.purchasePrice,
        });
      }
    }

    const totals = calculateSaleTotals(
      resolvedItems.map((r) => ({
        quantity: r.input.quantity,
        unitPrice: r.input.unitPrice,
        unitCost: r.unitCost,
        discount: r.input.discount,
      })),
      input.discount
    );

    const invoiceNumber = input.invoiceNumber?.trim() || (await generateUniqueInvoiceNumber(tx));

    const sale = await tx.sale.create({
      data: {
        invoiceNumber,
        customerId: input.customerId || null,
        walkInCustomerName: input.customerId ? null : input.walkInCustomerName?.trim() || 'Walk-in Customer',
        walkInCustomerPhone: input.customerId ? null : input.walkInCustomerPhone?.trim() || null,
        saleDate,
        subtotal: totals.subtotal,
        discount: totals.invoiceDiscount,
        totalAmount: totals.totalAmount,
        totalCost: totals.totalCost,
        grossProfit: totals.grossProfit,
        paymentMethod: 'CASH',
        status: 'COMPLETED',
        notes: input.notes || null,
      },
    });

    for (const resolved of resolvedItems) {
      const { input: item, unitCost, serialNumber } = resolved;
      const product = productMap.get(item.productId)!;
      const lineTotal = Math.max(0, item.quantity * item.unitPrice - item.discount);

      const saleItem = await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productId: product.id,
          serializedItemId: item.serializedItemId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost,
          discount: item.discount,
          totalAmount: lineTotal,
          warrantyMonths: item.warrantyMonths,
        },
      });

      let linePreviousStock = product.currentStock;

      if (product.inventoryType === 'SERIALIZED' && item.serializedItemId) {
        // Atomic claim — fails if a concurrent sale already took this unit.
        const claimed = await tx.serializedInventoryItem.updateMany({
          where: { id: item.serializedItemId, stockStatus: 'IN_STOCK' },
          data: { stockStatus: 'SOLD' },
        });
        if (claimed.count === 0) {
          throw new BusinessRuleError(
            `Serial number ${serialNumber} is no longer available. It may have just been sold.`
          );
        }
        const synced = await syncSerializedProductStock(tx, product.id);
        product.currentStock = synced;
        linePreviousStock = synced + 1;
      } else {
        // Atomic guarded decrement — cannot drive stock below zero.
        const decremented = await tx.product.updateMany({
          where: { id: product.id, currentStock: { gte: item.quantity } },
          data: { currentStock: { decrement: item.quantity } },
        });
        if (decremented.count === 0) {
          throw new BusinessRuleError(
            `Insufficient stock for ${product.name}. Available: ${product.currentStock}, requested: ${item.quantity}.`
          );
        }
        const fresh = await tx.product.findUnique({
          where: { id: product.id },
          select: { currentStock: true },
        });
        product.currentStock = fresh?.currentStock ?? linePreviousStock - item.quantity;
        linePreviousStock = product.currentStock + item.quantity;
      }

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          serializedItemId: item.serializedItemId || null,
          movementType: 'SALE',
          quantity: item.quantity,
          referenceType: 'SALE',
          referenceId: sale.id,
          previousStock: linePreviousStock,
          newStock: product.currentStock,
          reason: serialNumber ? `Sale ${invoiceNumber} (SN: ${serialNumber})` : `Sale ${invoiceNumber}`,
          createdAt: saleDate,
        },
      });

      if (item.warrantyMonths > 0) {
        const warrantyEnd = calculateWarrantyEndDate(saleDate, item.warrantyMonths);
        await tx.warranty.create({
          data: {
            saleId: sale.id,
            saleItemId: saleItem.id,
            customerId: input.customerId || null,
            productId: product.id,
            serializedItemId: item.serializedItemId || null,
            warrantyStart: saleDate,
            warrantyEnd,
            durationMonths: item.warrantyMonths,
            warrantyTerms: defaultWarrantyTerms,
            status: warrantyEnd.getTime() >= Date.now() ? 'ACTIVE' : 'EXPIRED',
          },
        });
      }
    }

    await recordAuditLog(tx, {
      entityType: 'Sale',
      entityId: sale.id,
      action: 'CREATE',
      updatedData: {
        invoiceNumber,
        totalAmount: totals.totalAmount,
        grossProfit: totals.grossProfit,
        itemsCount: resolvedItems.length,
      },
      adminUserId,
    });

    return sale;
  }));
}

async function reverseSaleEffects(tx: Prisma.TransactionClient, saleId: string) {
  const existing = await tx.sale.findUnique({
    where: { id: saleId },
    include: {
      items: { include: { product: true, serializedItem: true } },
      returns: { select: { id: true } },
    },
  });
  if (!existing) throw new BusinessRuleError('Sale invoice not found.', 404);
  if (existing.status === 'CANCELLED') {
    throw new BusinessRuleError('This sale invoice is already cancelled.');
  }
  if (existing.returns.length > 0) {
    throw new BusinessRuleError(
      'Cannot edit or delete this sale because returns or exchanges are already recorded against it.'
    );
  }

  for (const item of existing.items) {
    const freshProduct = await tx.product.findUnique({ where: { id: item.productId } });
    if (!freshProduct) continue;
    const prevStock = freshProduct.currentStock;

    if (item.serializedItemId) {
      await tx.serializedInventoryItem.update({
        where: { id: item.serializedItemId },
        data: { stockStatus: 'IN_STOCK' },
      });
      const synced = await syncSerializedProductStock(tx, freshProduct.id);
      await tx.stockMovement.create({
        data: {
          productId: freshProduct.id,
          serializedItemId: item.serializedItemId,
          movementType: 'REVERSAL',
          quantity: 1,
          referenceType: 'SALE',
          referenceId: existing.id,
          previousStock: prevStock,
          newStock: synced,
          reason: `Reversal of Sale ${existing.invoiceNumber}`,
        },
      });
    } else {
      await tx.product.update({
        where: { id: freshProduct.id },
        data: { currentStock: { increment: item.quantity } },
      });
      const restocked = await tx.product.findUnique({
        where: { id: freshProduct.id },
        select: { currentStock: true },
      });
      const nextStock = restocked?.currentStock ?? prevStock + item.quantity;
      await tx.stockMovement.create({
        data: {
          productId: freshProduct.id,
          movementType: 'REVERSAL',
          quantity: item.quantity,
          referenceType: 'SALE',
          referenceId: existing.id,
          previousStock: prevStock,
          newStock: nextStock,
          reason: `Reversal of Sale ${existing.invoiceNumber}`,
        },
      });
    }
  }

  await tx.warranty.updateMany({
    where: { saleId: existing.id },
    data: { status: 'VOID' },
  });

  return existing;
}

export async function updateSale(id: string, input: SalePayload, adminUserId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await reverseSaleEffects(tx, id);
    const saleDate = new Date(input.saleDate);
    if (Number.isNaN(saleDate.getTime())) {
      throw new BusinessRuleError('Invalid sale date.');
    }

    // Delete old warranties & sale items so new ones can be cleanly created
    await tx.warranty.deleteMany({ where: { saleId: id } });
    await tx.saleItem.deleteMany({ where: { saleId: id } });

    const settings = await tx.shopSettings.findUnique({ where: { id: 'default' } });
    const defaultWarrantyTerms = settings?.warrantyTerms || 'Standard Shop Checking Warranty';

    const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
    const serializedIds = input.items
      .map((i) => i.serializedItemId)
      .filter((sid): sid is string => Boolean(sid));

    const [products, serializedItems] = await Promise.all([
      tx.product.findMany({ where: { id: { in: productIds } } }),
      serializedIds.length > 0
        ? tx.serializedInventoryItem.findMany({ where: { id: { in: serializedIds } } })
        : Promise.resolve([]),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const serialMap = new Map(serializedItems.map((s) => [s.id, s]));

    const seenSerialIds = new Set<string>();
    const quantityRequests = new Map<string, number>();

    const resolvedItems: Array<{ input: SaleItemInput; unitCost: number; serialNumber?: string }> = [];

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) throw new BusinessRuleError('Selected product not found.');

      if (product.inventoryType === 'SERIALIZED') {
        if (!item.serializedItemId || item.quantity !== 1) {
          throw new BusinessRuleError(`${product.name} requires a single serial number.`);
        }
        if (seenSerialIds.has(item.serializedItemId)) {
          throw new BusinessRuleError('Duplicate serial number in invoice.');
        }
        seenSerialIds.add(item.serializedItemId);
        const serialItem = serialMap.get(item.serializedItemId);
        if (!serialItem || serialItem.productId !== product.id || serialItem.stockStatus !== 'IN_STOCK') {
          throw new BusinessRuleError(`Serial number for ${product.name} is not available in stock.`);
        }
        resolvedItems.push({ input: item, unitCost: serialItem.purchasePrice, serialNumber: serialItem.serialNumber });
      } else {
        const accumulatedQty = (quantityRequests.get(product.id) ?? 0) + item.quantity;
        if (!validateStockDeduction(product.currentStock, accumulatedQty)) {
          throw new BusinessRuleError(`Insufficient stock for ${product.name}. Available: ${product.currentStock}.`);
        }
        quantityRequests.set(product.id, accumulatedQty);
        resolvedItems.push({ input: item, unitCost: product.purchasePrice });
      }
    }

    const totals = calculateSaleTotals(
      resolvedItems.map((r) => ({
        quantity: r.input.quantity,
        unitPrice: r.input.unitPrice,
        unitCost: r.unitCost,
        discount: r.input.discount,
      })),
      input.discount
    );

    const updatedSale = await tx.sale.update({
      where: { id },
      data: {
        invoiceNumber: input.invoiceNumber?.trim() || existing.invoiceNumber,
        customerId: input.customerId || null,
        walkInCustomerName: input.customerId ? null : input.walkInCustomerName?.trim() || 'Walk-in Customer',
        walkInCustomerPhone: input.customerId ? null : input.walkInCustomerPhone?.trim() || null,
        saleDate,
        subtotal: totals.subtotal,
        discount: totals.invoiceDiscount,
        totalAmount: totals.totalAmount,
        totalCost: totals.totalCost,
        grossProfit: totals.grossProfit,
        notes: input.notes || null,
      },
    });

    for (const resolved of resolvedItems) {
      const { input: item, unitCost, serialNumber } = resolved;
      const product = productMap.get(item.productId)!;
      const lineTotal = Math.max(0, item.quantity * item.unitPrice - item.discount);

      const saleItem = await tx.saleItem.create({
        data: {
          saleId: id,
          productId: product.id,
          serializedItemId: item.serializedItemId || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost,
          discount: item.discount,
          totalAmount: lineTotal,
          warrantyMonths: item.warrantyMonths,
        },
      });

      let linePreviousStock = product.currentStock;
      if (product.inventoryType === 'SERIALIZED' && item.serializedItemId) {
        // Atomic claim — fails if a concurrent sale already took this unit.
        const claimed = await tx.serializedInventoryItem.updateMany({
          where: { id: item.serializedItemId, stockStatus: 'IN_STOCK' },
          data: { stockStatus: 'SOLD' },
        });
        if (claimed.count === 0) {
          throw new BusinessRuleError(
            `Serial number ${serialNumber} is no longer available. It may have just been sold.`
          );
        }
        product.currentStock = await syncSerializedProductStock(tx, product.id);
        linePreviousStock = product.currentStock + 1;
      } else {
        // Atomic guarded decrement — cannot drive stock below zero.
        const decremented = await tx.product.updateMany({
          where: { id: product.id, currentStock: { gte: item.quantity } },
          data: { currentStock: { decrement: item.quantity } },
        });
        if (decremented.count === 0) {
          throw new BusinessRuleError(
            `Insufficient stock for ${product.name}. Available: ${product.currentStock}, requested: ${item.quantity}.`
          );
        }
        const fresh = await tx.product.findUnique({
          where: { id: product.id },
          select: { currentStock: true },
        });
        product.currentStock = fresh?.currentStock ?? linePreviousStock - item.quantity;
        linePreviousStock = product.currentStock + item.quantity;
      }

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          serializedItemId: item.serializedItemId || null,
          movementType: 'SALE',
          quantity: item.quantity,
          referenceType: 'SALE',
          referenceId: id,
          previousStock: linePreviousStock,
          newStock: product.currentStock,
          reason: serialNumber
            ? `Edited Sale ${updatedSale.invoiceNumber} (SN: ${serialNumber})`
            : `Edited Sale ${updatedSale.invoiceNumber}`,
          createdAt: saleDate,
        },
      });

      if (item.warrantyMonths > 0) {
        const warrantyEnd = calculateWarrantyEndDate(saleDate, item.warrantyMonths);
        await tx.warranty.create({
          data: {
            saleId: id,
            saleItemId: saleItem.id,
            customerId: input.customerId || null,
            productId: product.id,
            serializedItemId: item.serializedItemId || null,
            warrantyStart: saleDate,
            warrantyEnd,
            durationMonths: item.warrantyMonths,
            warrantyTerms: defaultWarrantyTerms,
            status: warrantyEnd.getTime() >= Date.now() ? 'ACTIVE' : 'EXPIRED',
          },
        });
      }
    }

    await recordAuditLog(tx, {
      entityType: 'Sale',
      entityId: id,
      action: 'UPDATE',
      previousData: { totalAmount: existing.totalAmount, grossProfit: existing.grossProfit },
      updatedData: { totalAmount: totals.totalAmount, grossProfit: totals.grossProfit },
      adminUserId,
    });

    return updatedSale;
  });
}

export async function deleteSale(id: string, adminUserId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await reverseSaleEffects(tx, id);
    const cancelled = await tx.sale.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await recordAuditLog(tx, {
      entityType: 'Sale',
      entityId: id,
      action: 'DELETE',
      previousData: { invoiceNumber: existing.invoiceNumber, totalAmount: existing.totalAmount },
      updatedData: { status: 'CANCELLED' },
      adminUserId,
    });

    return cancelled;
  });
}
