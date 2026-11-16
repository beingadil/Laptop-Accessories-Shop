'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { ProductForm, type ProductFormInitialData } from '@/components/forms/ProductForm';

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const [initialData, setInitialData] = React.useState<ProductFormInitialData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/products/${params.id}`)
      .then((r) => r.json())
      .then((p) => {
        if (p?.id) {
          setInitialData({
            id: p.id,
            name: p.name,
            sku: p.sku,
            categoryId: p.categoryId,
            brand: p.brand,
            model: p.model,
            processor: p.processor || '',
            ram: p.ram || '',
            ssd: p.ssd || '',
            hdd: p.hdd || '',
            storage: p.storage || '',
            screenSize: p.screenSize || '',
            condition: p.condition,
            description: p.description || '',
            purchasePrice: p.purchasePrice,
            sellingPrice: p.sellingPrice,
            minimumStock: p.minimumStock,
            inventoryType: p.inventoryType,
            status: p.status,
            currentStock: p.currentStock,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppShell pageTitle="Edit Product">
      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : initialData ? (
        <ProductForm initialData={initialData} />
      ) : (
        <p className="text-sm text-slate-500">Product not found.</p>
      )}
    </AppShell>
  );
}
