'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FormPageShell } from '@/components/forms/FormPageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DatePicker } from '@/components/ui/date-picker';
import { formatDateInput, formatPKR } from '@/lib/format';

export interface SupplierPaymentInitialData {
  id?: string;
  supplierId: string;
  paymentDate: string;
  amount: number;
  referenceNumber: string;
  notes: string;
}

interface SupplierOption {
  id: string;
  name: string;
  phone: string;
  outstandingBalance: number;
}

export function SupplierPaymentForm({
  initialData,
  defaultSupplierId,
}: {
  initialData?: SupplierPaymentInitialData;
  defaultSupplierId?: string;
}) {
  const router = useRouter();
  const isEditing = Boolean(initialData?.id);
  const [suppliers, setSuppliers] = React.useState<SupplierOption[]>([]);
  const [form, setForm] = React.useState<SupplierPaymentInitialData>(
    initialData ?? {
      supplierId: defaultSupplierId || '',
      paymentDate: formatDateInput(new Date()),
      amount: 0,
      referenceNumber: '',
      notes: '',
    }
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    fetch('/api/suppliers?all=1')
      .then((r) => r.json())
      .then((d) => setSuppliers(d.items || []));
  }, []);

  const selectedSupplier = suppliers.find((s) => s.id === form.supplierId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.supplierId) {
      setError('Please select a supplier.');
      return;
    }
    if (form.amount <= 0) {
      setError('Payment amount must be greater than 0.');
      return;
    }
    setSaving(true);
    try {
      const url = isEditing ? `/api/supplier-payments/${initialData!.id}` : '/api/supplier-payments';
      const method = isEditing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, paymentMethod: 'CASH' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save payment.');
        setSaving(false);
        return;
      }
      toast.success(isEditing ? 'Supplier payment updated' : 'Supplier payment recorded');
      router.push('/supplier-payments');
      router.refresh();
    } catch {
      setError('Network error while saving payment.');
      setSaving(false);
    }
  }

  return (
    <FormPageShell
      title={isEditing ? 'Edit Supplier Payment' : 'Record Supplier Payment'}
      subtitle="Log a cash payment to a supplier and automatically update their ledger balance."
      backHref="/supplier-payments"
      backLabel="Back to Supplier Payments"
      submitLabel={isEditing ? 'Update Payment' : 'Save Payment'}
      saving={saving}
      formId="supplier-payment-form"
    >
      <form id="supplier-payment-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Payment Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label required>Supplier</Label>
              <SearchableSelect
                options={suppliers.map((s) => ({
                  value: s.id,
                  label: s.name,
                  sublabel: `${s.phone} · Outstanding: ${formatPKR(s.outstandingBalance)}`,
                }))}
                value={form.supplierId}
                onChange={(val) => setForm({ ...form, supplierId: val })}
                placeholder="Select supplier..."
              />
              {selectedSupplier && (
                <p className="text-xs text-slate-600 pt-1">
                  Current Outstanding Balance:{' '}
                  <strong className="font-mono text-amber-700">
                    {formatPKR(selectedSupplier.outstandingBalance)}
                  </strong>
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-date" required>
                Payment Date
              </Label>
              <DatePicker
                id="pay-date"
                value={form.paymentDate}
                onChange={(val) => setForm({ ...form, paymentDate: val })}
                ariaLabel="Payment Date"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-amount" required>
                Amount Paid (PKR)
              </Label>
              <Input
                id="pay-amount"
                type="number"
                min={1}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                className="tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-method">Payment Method</Label>
              <Input id="pay-method" value="CASH" disabled />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pay-ref">Reference / Receipt Number</Label>
              <Input
                id="pay-ref"
                value={form.referenceNumber}
                onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                placeholder="Optional receipt reference"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pay-notes">Notes</Label>
              <Textarea
                id="pay-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Optional remarks..."
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </FormPageShell>
  );
}
