'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import {
  SupplierPaymentForm,
  type SupplierPaymentInitialData,
} from '@/components/forms/SupplierPaymentForm';
import { formatDateInput } from '@/lib/format';

export default function EditSupplierPaymentPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = React.useState<SupplierPaymentInitialData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/supplier-payments/${params.id}`)
      .then((r) => r.json())
      .then((p) => {
        if (p?.id) {
          setData({
            id: p.id,
            supplierId: p.supplierId,
            paymentDate: formatDateInput(p.paymentDate),
            amount: p.amount,
            referenceNumber: p.referenceNumber || '',
            notes: p.notes || '',
          });
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppShell pageTitle="Edit Supplier Payment">
      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : data ? (
        <SupplierPaymentForm initialData={data} />
      ) : (
        <p className="text-sm text-slate-500">Payment not found.</p>
      )}
    </AppShell>
  );
}
