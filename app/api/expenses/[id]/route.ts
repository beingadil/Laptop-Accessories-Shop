import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth, handleApiError, BusinessRuleError } from '@/lib/api-utils';
import { expenseSchema } from '@/lib/validation/schemas';
import { recordAuditLog } from '@/lib/services/audit';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.errorResponse) return auth.errorResponse;
    const { id } = await context.params;
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!expense) return NextResponse.json({ error: 'Expense not found.' }, { status: 404 });
    return NextResponse.json(expense);
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
    const data = expenseSchema.parse(body);

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.expense.findUnique({ where: { id } });
      if (!existing) throw new BusinessRuleError('Expense not found.', 404);
      const expense = await tx.expense.update({
        where: { id },
        data: {
          title: data.title,
          categoryId: data.categoryId,
          amount: data.amount,
          expenseDate: new Date(data.expenseDate),
          description: data.description || null,
          notes: data.notes || null,
        },
        include: { category: true },
      });
      await recordAuditLog(tx, {
        entityType: 'Expense',
        entityId: id,
        action: 'UPDATE',
        previousData: existing,
        updatedData: expense,
        adminUserId: auth.session.userId,
      });
      return expense;
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
      const existing = await tx.expense.findUnique({ where: { id } });
      if (!existing) throw new BusinessRuleError('Expense not found.', 404);
      await tx.expense.update({ where: { id }, data: { status: 'INACTIVE' } });
      await recordAuditLog(tx, {
        entityType: 'Expense',
        entityId: id,
        action: 'DELETE',
        previousData: existing,
        updatedData: { status: 'INACTIVE' },
        adminUserId: auth.session.userId,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
