import { AppShell } from '@/components/layout/AppShell';
import { ExpenseForm } from '@/components/forms/ExpenseForm';

export default function NewExpensePage() {
  return (
    <AppShell pageTitle="Add Expense">
      <ExpenseForm />
    </AppShell>
  );
}
