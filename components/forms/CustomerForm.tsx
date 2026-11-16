'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FormPageShell } from '@/components/forms/FormPageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface CustomerFormInitialData {
  id?: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
}

export function CustomerForm({ initialData }: { initialData?: CustomerFormInitialData }) {
  const router = useRouter();
  const isEditing = Boolean(initialData?.id);
  const [form, setForm] = React.useState<CustomerFormInitialData>(
    initialData ?? { name: '', phone: '', address: '', notes: '' }
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Customer name and phone number are required.');
      return;
    }
    setSaving(true);
    try {
      const url = isEditing ? `/api/customers/${initialData!.id}` : '/api/customers';
      const method = isEditing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save customer.');
        setSaving(false);
        return;
      }
      toast.success(isEditing ? 'Customer updated' : 'Customer created');
      router.push('/customers');
      router.refresh();
    } catch {
      setError('Network error while saving customer.');
      setSaving(false);
    }
  }

  return (
    <FormPageShell
      title={isEditing ? `Edit Customer: ${initialData?.name}` : 'Add New Customer'}
      subtitle="Maintain customer contact details for invoices and warranty tracking."
      backHref="/customers"
      backLabel="Back to Customers"
      submitLabel={isEditing ? 'Update Customer' : 'Save Customer'}
      saving={saving}
      formId="customer-form"
    >
      <form id="customer-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cust-name" required>
                Full Name
              </Label>
              <Input
                id="cust-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Usman Tariq"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-phone" required>
                Phone Number
              </Label>
              <Input
                id="cust-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="03XX-XXXXXXX"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cust-address">Address</Label>
              <Input
                id="cust-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Customer address (optional)"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cust-notes">Notes</Label>
              <Textarea
                id="cust-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Preferences or remarks..."
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </FormPageShell>
  );
}
