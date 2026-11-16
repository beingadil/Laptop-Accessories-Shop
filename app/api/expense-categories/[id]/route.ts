import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, BusinessRuleError } from '@/lib/api-utils';
import { recordAuditLog } from '@/lib/services/audit';

const updateCategorySchema = z.object({
  name: z.string().trim().min(2, 'Category name must be at least 2 characters').max(80).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;
    const body = await req.json();
    const data = updateCategorySchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.expenseCategory.findUnique({ where: { id } });
      if (!existing) throw new BusinessRuleError('Expense category not found.', 404);

      const w = await tx.expenseCategory.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.status ? { status: data.status } : {}),
        },
      });

      await recordAuditLog(tx, {
        entityType: 'ExpenseCategory',
        entityId: id,
        action: 'UPDATE',
        previousData: existing,
        updatedData: w,
        adminUserId: auth.session.userId,
      });

      return w;
    });

    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.expenseCategory.findUnique({
        where: { id },
        include: { _count: { select: { expenses: true } } },
      });
      if (!existing) throw new BusinessRuleError('Expense category not found.', 404);

      if (existing._count.expenses > 0) {
        throw new BusinessRuleError(
          `Cannot delete "${existing.name}" because ${existing._count.expenses} expense(s) use it. Mark it Inactive instead.`
        );
      }

      await tx.expenseCategory.delete({ where: { id } });

      await recordAuditLog(tx, {
        entityType: 'ExpenseCategory',
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
