'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { PurchaseForm, type PurchaseFormInitialData } from '@/components/forms/PurchaseForm';
import { formatDateInput } from '@/lib/format';

export default function EditPurchasePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = React.useState<PurchaseFormInitialData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/purchases/${params.id}`)
      .then((r) => r.json())
      .then((p) => {
        if (p?.id) {
          setData({
            id: p.id,
            purchaseNumber: p.purchaseNumber,
            supplierId: p.supplierId,
            purchaseDate: formatDateInput(p.purchaseDate),
            paidAmount: p.paidAmount,
            notes: p.notes || '',
            items: p.items.map(
              (item: {
                id: string;
                productId: string;
                quantity: number;
                unitCost: number;
                condition: 'NEW' | 'USED' | 'REFURBISHED' | null;
                serialNumbers: string | null;
              }) => ({
                key: item.id,
                productId: item.productId,
                quantity: item.quantity,
                unitCost: item.unitCost,
                condition: item.condition || 'USED',
                serialsText: item.serialNumbers || '',
              })
            ),
          });
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppShell pageTitle="Edit Purchase">
      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : data ? (
        <PurchaseForm initialData={data} />
      ) : (
        <p className="text-sm text-slate-500">Purchase not found.</p>
      )}
    </AppShell>
  );
}
