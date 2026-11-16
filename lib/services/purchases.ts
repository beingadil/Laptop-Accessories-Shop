import { prisma } from '@/lib/prisma';
import { BusinessRuleError } from '@/lib/api-utils';
import {
  calculateSupplierOutstanding,
  calculateWeightedAverageCost,
  validateUniqueSerials,
} from '@/lib/domain/calculations';
import { recordAuditLog } from '@/lib/services/audit';
import { syncSerializedProductStock } from '@/lib/services/inventory';
import { withTransactionRetry } from '@/lib/services/tx-retry';
import type { ItemCondition, Prisma } from '@prisma/client';

export interface PurchaseItemInput {
  productId: string;
  quantity: number;
  unitCost: number;
  sellingPrice?: number;
  condition: ItemCondition;
  serialNumbers?: string[];
}

export interface PurchasePayload {
  purchaseNumber?: string;
  supplierId: string;
  purchaseDate: string;
  paidAmount: number;
  notes?: string | null;
  items: PurchaseItemInput[];
}

export async function recalculateSupplierBalance(tx: Prisma.TransactionClient, supplierId: string) {
  const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return 0;

  const [purchaseAgg, paymentAgg] = await Promise.all([
    tx.purchase.aggregate({
      where: { supplierId, status: 'COMPLETED' },
      _sum: { outstandingAmount: true },
    }),
    tx.supplierPayment.aggregate({
      where: { supplierId, status: 'COMPLETED' },
      _sum: { amount: true },
    }),
  ]);

  const outstanding = calculateSupplierOutstanding({
    openingBalance: supplier.openingBalance,
    purchasesOutstandingSum: purchaseAgg._sum.outstandingAmount ?? 0,
    paymentsSum: paymentAgg._sum.amount ?? 0,
  });

  await tx.supplier.update({
    where: { id: supplierId },
    data: { outstandingBalance: outstanding },
  });

  return outstanding;
}

async function generateUniquePurchaseNumber(tx: Prisma.TransactionClient): Promise<string> {
  const settings = await tx.shopSettings.findUnique({ where: { id: 'default' } });
  const prefix = settings?.purchasePrefix || 'TE-PUR-';
  const count = await tx.purchase.count();
  const last = await tx.purchase.findFirst({
    where: { purchaseNumber: { startsWith: prefix } },
    orderBy: { purchaseNumber: 'desc' },
    select: { purchaseNumber: true },
  });
  const lastSeq = last ? parseInt(last.purchaseNumber.slice(prefix.length), 10) : NaN;
  let seq = Number.isFinite(lastSeq) ? Math.max(1001 + count, lastSeq + 1) : 1001 + count;
  while (true) {
    const candidate = `${prefix}${seq}`;
    const exists = await tx.purchase.findUnique({
      where: { purchaseNumber: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
    seq += 1;
  }
}

export async function createPurchase(input: PurchasePayload, adminUserId: string) {
  return withTransactionRetry(() =>
    prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) {
      throw new BusinessRuleError('Selected supplier does not exist.', 404);
    }

    const purchaseDate = new Date(input.purchaseDate);
    if (Number.isNaN(purchaseDate.getTime())) {
      throw new BusinessRuleError('Invalid purchase date.');
    }

    const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const allSerials: string[] = [];
    let totalAmount = 0;

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new BusinessRuleError('One of the selected products does not exist.');
      }
      if (product.inventoryType === 'SERIALIZED') {
        const serials = (item.serialNumbers || []).map((s) => s.trim()).filter(Boolean);
        if (serials.length !== item.quantity) {
          throw new BusinessRuleError(
            `${product.name} requires exactly ${item.quantity} serial number(s), received ${serials.length}.`
          );
        }
        allSerials.push(...serials);
      }
      totalAmount += item.quantity * item.unitCost;
    }

    if (allSerials.length > 0) {
      const uniqueCheck = validateUniqueSerials(allSerials);
      if (!uniqueCheck.valid) {
        throw new BusinessRuleError(`Duplicate serial numbers in purchase: ${uniqueCheck.duplicates.join(', ')}`);
      }
      const existingSerials = await tx.serializedInventoryItem.findMany({
        where: { serialNumber: { in: allSerials } },
        select: { serialNumber: true },
      });
      if (existingSerials.length > 0) {
        throw new BusinessRuleError(
          `Serial number(s) already exist: ${existingSerials.map((s) => s.serialNumber).join(', ')}`
        );
      }
    }

    if (input.paidAmount > totalAmount) {
      throw new BusinessRuleError('Paid amount cannot exceed purchase total amount.');
    }

    const purchaseNumber = input.purchaseNumber?.trim() || (await generateUniquePurchaseNumber(tx));
    const outstandingAmount = Math.max(0, totalAmount - input.paidAmount);

    const purchase = await tx.purchase.create({
      data: {
        purchaseNumber,
        supplierId: supplier.id,
        purchaseDate,
        totalAmount,
        paidAmount: input.paidAmount,
        outstandingAmount,
        notes: input.notes || null,
        status: 'COMPLETED',
      },
    });

    for (const item of input.items) {
      const product = productMap.get(item.productId)!;
      const serials = (item.serialNumbers || []).map((s) => s.trim()).filter(Boolean);

      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          productId: product.id,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.quantity * item.unitCost,
          condition: item.condition,
          serialNumbers: serials.length > 0 ? serials.join(', ') : null,
        },
      });

      const previousStock = product.currentStock;
      const newAvgCost = calculateWeightedAverageCost(
        previousStock,
        product.purchasePrice,
        item.quantity,
        item.unitCost
      );

      if (product.inventoryType === 'SERIALIZED') {
        let runningStock = previousStock;
        for (const sn of serials) {
          runningStock += 1;
          const createdSerial = await tx.serializedInventoryItem.create({
            data: {
              productId: product.id,
              serialNumber: sn,
              purchasePrice: item.unitCost,
              sellingPrice: item.sellingPrice ?? product.sellingPrice,
              condition: item.condition,
              purchaseId: purchase.id,
              stockStatus: 'IN_STOCK',
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              serializedItemId: createdSerial.id,
              movementType: 'PURCHASE',
              quantity: 1,
              referenceType: 'PURCHASE',
              referenceId: purchase.id,
              previousStock: runningStock - 1,
              newStock: runningStock,
              reason: `Purchase ${purchaseNumber} (SN: ${sn})`,
              createdAt: purchaseDate,
            },
          });
        }

        const syncedStock = await syncSerializedProductStock(tx, product.id);
        await tx.product.update({
          where: { id: product.id },
          data: {
            purchasePrice: newAvgCost,
            ...(item.sellingPrice !== undefined ? { sellingPrice: item.sellingPrice } : {}),
          },
        });
        product.currentStock = syncedStock;
      } else {
        const newStock = previousStock + item.quantity;
        await tx.product.update({
          where: { id: product.id },
          data: {
            currentStock: { increment: item.quantity },
            purchasePrice: newAvgCost,
            ...(item.sellingPrice !== undefined ? { sellingPrice: item.sellingPrice } : {}),
          },
        });
        product.currentStock = newStock;
        product.purchasePrice = newAvgCost;

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: 'PURCHASE',
            quantity: item.quantity,
            referenceType: 'PURCHASE',
            referenceId: purchase.id,
            previousStock,
            newStock,
            reason: `Purchase ${purchaseNumber}`,
            createdAt: purchaseDate,
          },
        });
      }
    }

    await recalculateSupplierBalance(tx, supplier.id);
    await recordAuditLog(tx, {
      entityType: 'Purchase',
      entityId: purchase.id,
      action: 'CREATE',
      updatedData: { purchaseNumber, totalAmount, paidAmount: input.paidAmount, itemCount: input.items.length },
      adminUserId,
    });

    return purchase;
  }));
}

async function reversePurchaseStock(tx: Prisma.TransactionClient, purchaseId: string, purchaseNumber: string) {
  const existing = await tx.purchase.findUnique({
    where: { id: purchaseId },
    include: {
      items: { include: { product: true } },
      serializedItems: true,
    },
  });
  if (!existing) throw new BusinessRuleError('Purchase not found.', 404);
  if (existing.status === 'CANCELLED') {
    throw new BusinessRuleError('This purchase has already been cancelled.');
  }

  // Ensure no serialized item from this purchase was already sold/damaged/lost
  const consumedSerials = existing.serializedItems.filter((s) => s.stockStatus !== 'IN_STOCK');
  if (consumedSerials.length > 0) {
    throw new BusinessRuleError(
      `Cannot modify or delete purchase ${purchaseNumber} because serialized item(s) ${consumedSerials
        .map((c) => c.serialNumber)
        .join(', ')} are no longer in stock.`
    );
  }

  // Remove unconsumed serialized items created by this purchase
  for (const serialItem of existing.serializedItems) {
    const product = await tx.product.findUnique({ where: { id: serialItem.productId } });
    const prevStock = product?.currentStock ?? 0;

    await tx.stockMovement.create({
      data: {
        productId: serialItem.productId,
        movementType: 'REVERSAL',
        quantity: 1,
        referenceType: 'PURCHASE',
        referenceId: existing.id,
        previousStock: prevStock,
        newStock: Math.max(0, prevStock - 1),
        reason: `Reversal of Purchase ${purchaseNumber} (SN: ${serialItem.serialNumber})`,
      },
    });
  }

  if (existing.serializedItems.length > 0) {
    // Unlink any historical StockMovement FK before deleting SerializedInventoryItem
    const serialIds = existing.serializedItems.map((s) => s.id);
    await tx.stockMovement.updateMany({
      where: { serializedItemId: { in: serialIds } },
      data: { serializedItemId: null },
    });
    await tx.serializedInventoryItem.deleteMany({
      where: { id: { in: serialIds } },
    });
  }

  // Reverse quantity items
  for (const item of existing.items) {
    if (item.product.inventoryType === 'QUANTITY') {
      const freshProduct = await tx.product.findUnique({ where: { id: item.productId } });
      if (!freshProduct) continue;
      const decremented = await tx.product.updateMany({
        where: { id: freshProduct.id, currentStock: { gte: item.quantity } },
        data: { currentStock: { decrement: item.quantity } },
      });
      if (decremented.count === 0) {
        throw new BusinessRuleError(
          `Cannot modify or delete purchase ${purchaseNumber} because ${item.quantity} units of ${freshProduct.name} are needed in stock to reverse it (current stock: ${freshProduct.currentStock}).`
        );
      }
      const nextStock = freshProduct.currentStock - item.quantity;
      await tx.stockMovement.create({
        data: {
          productId: freshProduct.id,
          movementType: 'REVERSAL',
          quantity: item.quantity,
          referenceType: 'PURCHASE',
          referenceId: existing.id,
          previousStock: freshProduct.currentStock,
          newStock: nextStock,
          reason: `Reversal of Purchase ${purchaseNumber}`,
        },
      });
    } else {
      await syncSerializedProductStock(tx, item.productId);
    }
  }

  return existing;
}

export async function updatePurchase(id: string, input: PurchasePayload, adminUserId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await reversePurchaseStock(tx, id, input.purchaseNumber || id);
    const oldSupplierId = existing.supplierId;

    const supplier = await tx.supplier.findUnique({ where: { id: input.supplierId } });
    if (!supplier) throw new BusinessRuleError('Selected supplier not found.', 404);

    const purchaseDate = new Date(input.purchaseDate);
    const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
    const products = await tx.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const allSerials: string[] = [];
    let totalAmount = 0;

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) throw new BusinessRuleError('Product not found.');
      if (product.inventoryType === 'SERIALIZED') {
        const serials = (item.serialNumbers || []).map((s) => s.trim()).filter(Boolean);
        if (serials.length !== item.quantity) {
          throw new BusinessRuleError(
            `${product.name} requires exactly ${item.quantity} serial number(s).`
          );
        }
        allSerials.push(...serials);
      }
      totalAmount += item.quantity * item.unitCost;
    }

    if (allSerials.length > 0) {
      const uniqueCheck = validateUniqueSerials(allSerials);
      if (!uniqueCheck.valid) {
        throw new BusinessRuleError(`Duplicate serial numbers: ${uniqueCheck.duplicates.join(', ')}`);
      }
      const dupes = await tx.serializedInventoryItem.findMany({
        where: { serialNumber: { in: allSerials } },
        select: { serialNumber: true },
      });
      if (dupes.length > 0) {
        throw new BusinessRuleError(
          `Serial number(s) already exist: ${dupes.map((d) => d.serialNumber).join(', ')}`
        );
      }
    }

    if (input.paidAmount > totalAmount) {
      throw new BusinessRuleError('Paid amount cannot exceed purchase total amount.');
    }

    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });

    const outstandingAmount = Math.max(0, totalAmount - input.paidAmount);
    const updatedPurchase = await tx.purchase.update({
      where: { id },
      data: {
        purchaseNumber: input.purchaseNumber?.trim() || existing.purchaseNumber,
        supplierId: supplier.id,
        purchaseDate,
        totalAmount,
        paidAmount: input.paidAmount,
        outstandingAmount,
        notes: input.notes || null,
      },
    });

    for (const item of input.items) {
      const product = productMap.get(item.productId)!;
      const serials = (item.serialNumbers || []).map((s) => s.trim()).filter(Boolean);

      await tx.purchaseItem.create({
        data: {
          purchaseId: id,
          productId: product.id,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.quantity * item.unitCost,
          condition: item.condition,
          serialNumbers: serials.length > 0 ? serials.join(', ') : null,
        },
      });

      const previousStock = product.currentStock;
      const newAvgCost = calculateWeightedAverageCost(
        previousStock,
        product.purchasePrice,
        item.quantity,
        item.unitCost
      );

      if (product.inventoryType === 'SERIALIZED') {
        for (const sn of serials) {
          const createdSerial = await tx.serializedInventoryItem.create({
            data: {
              productId: product.id,
              serialNumber: sn,
              purchasePrice: item.unitCost,
              sellingPrice: item.sellingPrice ?? product.sellingPrice,
              condition: item.condition,
              purchaseId: id,
              stockStatus: 'IN_STOCK',
            },
          });

          await tx.stockMovement.create({
            data: {
              productId: product.id,
              serializedItemId: createdSerial.id,
              movementType: 'PURCHASE',
              quantity: 1,
              referenceType: 'PURCHASE',
              referenceId: id,
              previousStock,
              newStock: previousStock + serials.length,
              reason: `Edited Purchase ${updatedPurchase.purchaseNumber} (SN: ${sn})`,
              createdAt: purchaseDate,
            },
          });
        }
        await syncSerializedProductStock(tx, product.id);
        await tx.product.update({
          where: { id: product.id },
          data: { purchasePrice: newAvgCost },
        });
      } else {
        const nextStock = previousStock + item.quantity;
        await tx.product.update({
          where: { id: product.id },
          data: { currentStock: { increment: item.quantity }, purchasePrice: newAvgCost },
        });
        product.currentStock = nextStock;
        await tx.stockMovement.create({
          data: {
            productId: product.id,
            movementType: 'PURCHASE',
            quantity: item.quantity,
            referenceType: 'PURCHASE',
            referenceId: id,
            previousStock,
            newStock: nextStock,
            reason: `Edited Purchase ${updatedPurchase.purchaseNumber}`,
            createdAt: purchaseDate,
          },
        });
      }
    }

    await recalculateSupplierBalance(tx, oldSupplierId);
    if (oldSupplierId !== supplier.id) {
      await recalculateSupplierBalance(tx, supplier.id);
    }

    await recordAuditLog(tx, {
      entityType: 'Purchase',
      entityId: id,
      action: 'UPDATE',
      previousData: { totalAmount: existing.totalAmount, paidAmount: existing.paidAmount },
      updatedData: { totalAmount, paidAmount: input.paidAmount },
      adminUserId,
    });

    return updatedPurchase;
  });
}

export async function deletePurchase(id: string, adminUserId: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.purchase.findUnique({ where: { id } });
    if (!existing) throw new BusinessRuleError('Purchase not found.', 404);

    await reversePurchaseStock(tx, id, existing.purchaseNumber);

    const cancelled = await tx.purchase.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    await recalculateSupplierBalance(tx, existing.supplierId);
    await recordAuditLog(tx, {
      entityType: 'Purchase',
      entityId: id,
      action: 'DELETE',
      previousData: { purchaseNumber: existing.purchaseNumber, totalAmount: existing.totalAmount },
      updatedData: { status: 'CANCELLED' },
      adminUserId,
    });

    return cancelled;
  });
}
