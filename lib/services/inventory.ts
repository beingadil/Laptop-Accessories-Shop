import { prisma } from '@/lib/prisma';
import { BusinessRuleError } from '@/lib/errors';
import {
  calculateWeightedAverageCost,
  validateStockDeduction,
  validateUniqueSerials,
} from '@/lib/domain/calculations';
import { recordAuditLog } from '@/lib/services/audit';
import type { ItemCondition, Prisma } from '@prisma/client';

export async function syncSerializedProductStock(
  tx: Prisma.TransactionClient,
  productId: string
): Promise<number> {
  const count = await tx.serializedInventoryItem.count({
    where: { productId, stockStatus: 'IN_STOCK' },
  });
  await tx.product.update({
    where: { id: productId },
    data: { currentStock: count },
  });
  return count;
}

export async function recordOpeningStock(
  input: {
    productId: string;
    date: string;
    purchasePrice: number;
    sellingPrice: number;
    condition: ItemCondition;
    quantity?: number;
    serialNumbers?: string[];
    notes?: string | null;
  },
  adminUserId: string
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: input.productId },
    });
    if (!product) {
      throw new BusinessRuleError('Selected product was not found.', 404);
    }

    const movementDate = new Date(input.date);
    if (Number.isNaN(movementDate.getTime())) {
      throw new BusinessRuleError('Invalid opening stock date.');
    }

    if (product.inventoryType === 'SERIALIZED') {
      const serials = (input.serialNumbers || []).map((s) => s.trim()).filter(Boolean);
      if (serials.length === 0) {
        throw new BusinessRuleError('Please enter at least one serial number for this serialized product.');
      }

      const uniqueCheck = validateUniqueSerials(serials);
      if (!uniqueCheck.valid) {
        throw new BusinessRuleError(`Duplicate serial numbers entered: ${uniqueCheck.duplicates.join(', ')}`);
      }

      const existing = await tx.serializedInventoryItem.findMany({
        where: { serialNumber: { in: serials } },
        select: { serialNumber: true },
      });
      if (existing.length > 0) {
        throw new BusinessRuleError(
          `Serial number(s) already exist in inventory: ${existing.map((e) => e.serialNumber).join(', ')}`
        );
      }

      const previousStock = product.currentStock;
      const newStock = previousStock + serials.length;

      for (const sn of serials) {
        const createdItem = await tx.serializedInventoryItem.create({
          data: {
            productId: product.id,
            serialNumber: sn,
            purchasePrice: input.purchasePrice,
            sellingPrice: input.sellingPrice,
            condition: input.condition,
            stockStatus: 'IN_STOCK',
            notes: input.notes || 'Opening stock entry',
            createdAt: movementDate,
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            serializedItemId: createdItem.id,
            movementType: 'OPENING_STOCK',
            quantity: 1,
            referenceType: 'OPENING_STOCK',
            referenceId: createdItem.id,
            previousStock,
            newStock,
            reason: input.notes || `Opening stock (${sn})`,
            createdAt: movementDate,
          },
        });
      }

      const avgCost = calculateWeightedAverageCost(
        previousStock,
        product.purchasePrice,
        serials.length,
        input.purchasePrice
      );

      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          currentStock: newStock,
          purchasePrice: avgCost,
          sellingPrice: input.sellingPrice,
        },
      });

      await recordAuditLog(tx, {
        entityType: 'Product',
        entityId: product.id,
        action: 'UPDATE',
        previousData: { currentStock: previousStock },
        updatedData: { currentStock: newStock, addedSerials: serials },
        adminUserId,
      });

      return updatedProduct;
    } else {
      const qty = input.quantity ?? 0;
      if (qty <= 0) {
        throw new BusinessRuleError('Quantity must be greater than 0.');
      }

      const previousStock = product.currentStock;
      const newStock = previousStock + qty;
      const avgCost = calculateWeightedAverageCost(
        previousStock,
        product.purchasePrice,
        qty,
        input.purchasePrice
      );

      const updatedProduct = await tx.product.update({
        where: { id: product.id },
        data: {
          currentStock: newStock,
          purchasePrice: avgCost,
          sellingPrice: input.sellingPrice,
        },
      });

      await tx.stockMovement.create({
        data: {
          productId: product.id,
          movementType: 'OPENING_STOCK',
          quantity: qty,
          referenceType: 'OPENING_STOCK',
          previousStock,
          newStock,
          reason: input.notes || 'Opening stock entry',
          createdAt: movementDate,
        },
      });

      await recordAuditLog(tx, {
        entityType: 'Product',
        entityId: product.id,
        action: 'UPDATE',
        previousData: { currentStock: previousStock, purchasePrice: product.purchasePrice },
        updatedData: { currentStock: newStock, purchasePrice: avgCost },
        adminUserId,
      });

      return updatedProduct;
    }
  });
}

export async function recordStockAdjustment(
  input: {
    productId: string;
    adjustmentType: 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGED' | 'LOST';
    quantity: number;
    serializedItemId?: string | null;
    reason: string;
    date?: string;
  },
  adminUserId: string
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) {
      throw new BusinessRuleError('Product not found.', 404);
    }

    const movementDate = input.date ? new Date(input.date) : new Date();
    const previousStock = product.currentStock;

    if (product.inventoryType === 'SERIALIZED') {
      if (!input.serializedItemId) {
        throw new BusinessRuleError('Please select a specific serial number for serialized inventory adjustment.');
      }

      const item = await tx.serializedInventoryItem.findUnique({
        where: { id: input.serializedItemId },
      });
      if (!item || item.productId !== product.id) {
        throw new BusinessRuleError('Selected serial number does not belong to this product.');
      }

      if (input.adjustmentType === 'ADJUSTMENT_IN') {
        if (item.stockStatus === 'IN_STOCK') {
          throw new BusinessRuleError('This serial number is already in stock.');
        }
        if (item.stockStatus === 'SOLD') {
          throw new BusinessRuleError('Cannot adjust a sold serial number back in; use Returns & Exchanges.');
        }
        await tx.serializedInventoryItem.update({
          where: { id: item.id },
          data: { stockStatus: 'IN_STOCK' },
        });
      } else {
        if (item.stockStatus !== 'IN_STOCK') {
          throw new BusinessRuleError(`Serial number ${item.serialNumber} is not currently in stock.`);
        }
        const nextStatus =
          input.adjustmentType === 'DAMAGED'
            ? 'DAMAGED'
            : input.adjustmentType === 'LOST'
            ? 'LOST'
            : 'DAMAGED';
        await tx.serializedInventoryItem.update({
          where: { id: item.id },
          data: { stockStatus: nextStatus },
        });
      }

      const newStock = await syncSerializedProductStock(tx, product.id);
      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          serializedItemId: item.id,
          movementType: input.adjustmentType,
          quantity: 1,
          referenceType: 'ADJUSTMENT',
          referenceId: item.id,
          previousStock,
          newStock,
          reason: `${input.reason} (SN: ${item.serialNumber})`,
          createdAt: movementDate,
        },
      });

      await recordAuditLog(tx, {
        entityType: 'StockAdjustment',
        entityId: movement.id,
        action: 'CREATE',
        previousData: { stockStatus: item.stockStatus, stock: previousStock },
        updatedData: { adjustmentType: input.adjustmentType, stock: newStock, reason: input.reason },
        adminUserId,
      });

      return movement;
    } else {
      const isIncrease = input.adjustmentType === 'ADJUSTMENT_IN';
      if (!isIncrease && !validateStockDeduction(previousStock, input.quantity)) {
        throw new BusinessRuleError(
          `Insufficient stock. Available quantity is ${previousStock}, cannot deduct ${input.quantity}.`
        );
      }

      const newStock = isIncrease ? previousStock + input.quantity : previousStock - input.quantity;
      await tx.product.update({
        where: { id: product.id },
        data: { currentStock: newStock },
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId: product.id,
          movementType: input.adjustmentType,
          quantity: input.quantity,
          referenceType: 'ADJUSTMENT',
          previousStock,
          newStock,
          reason: input.reason,
          createdAt: movementDate,
        },
      });

      await recordAuditLog(tx, {
        entityType: 'StockAdjustment',
        entityId: movement.id,
        action: 'CREATE',
        previousData: { stock: previousStock },
        updatedData: { adjustmentType: input.adjustmentType, quantity: input.quantity, stock: newStock, reason: input.reason },
        adminUserId,
      });

      return movement;
    }
  });
}
