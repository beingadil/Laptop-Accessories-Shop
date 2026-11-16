import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { AppShell } from '@/components/layout/AppShell';
import { ExpenseForm } from '@/components/forms/ExpenseForm';
import { formatDateInput } from '@/lib/format';

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.status === 'INACTIVE') {
    notFound();
  }

  return (
    <AppShell pageTitle="Edit Expense">
      <ExpenseForm
        initialData={{
          id: expense.id,
          title: expense.title,
          categoryId: expense.categoryId,
          amount: expense.amount,
          expenseDate: formatDateInput(expense.expenseDate),
          description: expense.description || '',
          notes: expense.notes || '',
        }}
      />
    </AppShell>
  );
}
