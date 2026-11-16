'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { SupplierForm, type SupplierFormInitialData } from '@/components/forms/SupplierForm';

export default function EditSupplierPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = React.useState<SupplierFormInitialData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/suppliers/${params.id}`)
      .then((r) => r.json())
      .then((s) => {
        if (s?.id) {
          setData({
            id: s.id,
            name: s.name,
            phone: s.phone,
            address: s.address || '',
            notes: s.notes || '',
            openingBalance: s.openingBalance,
            status: s.status,
          });
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppShell pageTitle="Edit Supplier">
      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : data ? (
        <SupplierForm initialData={data} />
      ) : (
        <p className="text-sm text-slate-500">Supplier not found.</p>
      )}
    </AppShell>
  );
}
