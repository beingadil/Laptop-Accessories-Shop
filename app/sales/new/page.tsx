import { AppShell } from '@/components/layout/AppShell';
import { SaleForm } from '@/components/forms/SaleForm';

export default function NewSalePage() {
  return (
    <AppShell pageTitle="New Sale Invoice">
      <SaleForm />
    </AppShell>
  );
}
