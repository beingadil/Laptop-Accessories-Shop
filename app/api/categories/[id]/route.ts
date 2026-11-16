import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, BusinessRuleError } from '@/lib/api-utils';
import { categorySchema } from '@/lib/validation/schemas';
import { recordAuditLog } from '@/lib/services/audit';

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;
    const body = await req.json();
    const data = categorySchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.productCategory.findUnique({ where: { id } });
      if (!existing) throw new BusinessRuleError('Category not found.', 404);
      const cat = await tx.productCategory.update({ where: { id }, data });
      await recordAuditLog(tx, {
        entityType: 'ProductCategory',
        entityId: id,
        action: 'UPDATE',
        previousData: existing,
        updatedData: cat,
        adminUserId: auth.session.userId,
      });
      return cat;
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
      const existing = await tx.productCategory.findUnique({
        where: { id },
        include: { _count: { select: { products: true } } },
      });
      if (!existing) throw new BusinessRuleError('Category not found.', 404);
      if (existing._count.products > 0) {
        throw new BusinessRuleError(
          `Cannot delete category "${existing.name}" because ${existing._count.products} product(s) are assigned to it.`
        );
      }
      await tx.productCategory.delete({ where: { id } });
      await recordAuditLog(tx, {
        entityType: 'ProductCategory',
        entityId: id,
        action: 'DELETE',
        previousData: existing,
        adminUserId: auth.session.userId,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
