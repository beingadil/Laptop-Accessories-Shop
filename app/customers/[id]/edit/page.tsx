'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { CustomerForm, type CustomerFormInitialData } from '@/components/forms/CustomerForm';

export default function EditCustomerPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = React.useState<CustomerFormInitialData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/customers/${params.id}`)
      .then((r) => r.json())
      .then((c) => {
        if (c?.id) {
          setData({
            id: c.id,
            name: c.name,
            phone: c.phone,
            address: c.address || '',
            notes: c.notes || '',
          });
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppShell pageTitle="Edit Customer">
      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : data ? (
        <CustomerForm initialData={data} />
      ) : (
        <p className="text-sm text-slate-500">Customer not found.</p>
      )}
    </AppShell>
  );
}
