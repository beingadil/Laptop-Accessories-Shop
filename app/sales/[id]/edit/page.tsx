'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { SaleForm, type SaleFormInitialData } from '@/components/forms/SaleForm';
import { formatDateInput } from '@/lib/format';

export default function EditSalePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = React.useState<SaleFormInitialData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/sales/${params.id}`)
      .then((r) => r.json())
      .then((res) => {
        const s = res?.sale;
        if (s?.id) {
          setData({
            id: s.id,
            invoiceNumber: s.invoiceNumber,
            customerId: s.customerId || '',
            walkInCustomerName: s.walkInCustomerName || '',
            walkInCustomerPhone: s.walkInCustomerPhone || '',
            saleDate: formatDateInput(s.saleDate),
            discount: s.discount,
            notes: s.notes || '',
            items: s.items.map(
              (item: {
                id: string;
                productId: string;
                serializedItemId: string | null;
                serializedItem: { serialNumber: string } | null;
                quantity: number;
                unitPrice: number;
                unitCost: number;
                discount: number;
                warrantyMonths: number;
              }) => ({
                key: item.id,
                productId: item.productId,
                serializedItemId: item.serializedItemId || '',
                serializedLabel: item.serializedItem?.serialNumber,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                unitCost: item.unitCost,
                discount: item.discount,
                warrantyMonths: item.warrantyMonths,
              })
            ),
          });
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppShell pageTitle="Edit Sale Invoice">
      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : data ? (
        <SaleForm initialData={data} />
      ) : (
        <p className="text-sm text-slate-500">Sale invoice not found.</p>
      )}
    </AppShell>
  );
}
