import { AppShell } from '@/components/layout/AppShell';
import { ProductForm } from '@/components/forms/ProductForm';

export default function NewProductPage() {
  return (
    <AppShell pageTitle="Add Product">
      <ProductForm />
    </AppShell>
  );
}
