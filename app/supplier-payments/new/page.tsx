'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { SupplierPaymentForm } from '@/components/forms/SupplierPaymentForm';

function NewPaymentInner() {
  const sp = useSearchParams();
  const supplierId = sp.get('supplierId') || '';
  return <SupplierPaymentForm defaultSupplierId={supplierId} />;
}

export default function NewSupplierPaymentPage() {
  return (
    <AppShell pageTitle="Record Supplier Payment">
      <React.Suspense fallback={<div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />}>
        <NewPaymentInner />
      </React.Suspense>
    </AppShell>
  );
}
