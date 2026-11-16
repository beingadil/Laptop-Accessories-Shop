import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, BusinessRuleError } from '@/lib/api-utils';
import { productSchema } from '@/lib/validation/schemas';
import { recordAuditLog } from '@/lib/services/audit';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        serializedItems: {
          orderBy: { createdAt: 'desc' },
          include: { purchase: { select: { id: true, purchaseNumber: true } } },
        },
        stockMovements: {
          orderBy: { createdAt: 'desc' },
          take: 30,
          include: { serializedItem: { select: { serialNumber: true } } },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;
    const body = await req.json();
    const data = productSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({ where: { id } });
      if (!existing) throw new BusinessRuleError('Product not found.', 404);

      if (existing.inventoryType !== data.inventoryType && existing.currentStock > 0) {
        throw new BusinessRuleError(
          'Cannot change inventory tracking type while stock exists for this product.'
        );
      }

      const product = await tx.product.update({
        where: { id },
        data: {
          ...data,
          processor: data.processor || null,
          ram: data.ram || null,
          ssd: data.ssd || null,
          hdd: data.hdd || null,
          storage: data.storage || null,
          screenSize: data.screenSize || null,
          description: data.description || null,
        },
        include: { category: true },
      });

      await recordAuditLog(tx, {
        entityType: 'Product',
        entityId: id,
        action: 'UPDATE',
        previousData: { name: existing.name, sku: existing.sku, sellingPrice: existing.sellingPrice },
        updatedData: { name: product.name, sku: product.sku, sellingPrice: product.sellingPrice },
        adminUserId: auth.session.userId,
      });

      return product;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.product.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              saleItems: true,
              purchaseItems: true,
              serializedItems: true,
            },
          },
        },
      });
      if (!existing) throw new BusinessRuleError('Product not found.', 404);
      if (
        existing._count.saleItems > 0 ||
        existing._count.purchaseItems > 0 ||
        existing._count.serializedItems > 0
      ) {
        throw new BusinessRuleError(
          'Cannot delete this product because it has purchase, sale, or serialized stock history. You may mark it Inactive instead.'
        );
      }

      await tx.stockMovement.deleteMany({ where: { productId: id } });
      await tx.product.delete({ where: { id } });
      await recordAuditLog(tx, {
        entityType: 'Product',
        entityId: id,
        action: 'DELETE',
        previousData: { name: existing.name, sku: existing.sku },
        adminUserId: auth.session.userId,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
