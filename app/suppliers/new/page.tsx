import { AppShell } from '@/components/layout/AppShell';
import { SupplierForm } from '@/components/forms/SupplierForm';

export default function NewSupplierPage() {
  return (
    <AppShell pageTitle="Add Supplier">
      <SupplierForm />
    </AppShell>
  );
}
