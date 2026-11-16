import { AppShell } from '@/components/layout/AppShell';
import { CustomerForm } from '@/components/forms/CustomerForm';

export default function NewCustomerPage() {
  return (
    <AppShell pageTitle="Add Customer">
      <CustomerForm />
    </AppShell>
  );
}
