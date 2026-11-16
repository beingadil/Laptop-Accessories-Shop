import { AppShell } from '@/components/layout/AppShell';
import { PurchaseForm } from '@/components/forms/PurchaseForm';

export default function NewPurchasePage() {
  return (
    <AppShell pageTitle="New Purchase">
      <PurchaseForm />
    </AppShell>
  );
}
