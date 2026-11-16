'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FormPageShell } from '@/components/forms/FormPageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export interface SupplierFormInitialData {
  id?: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  openingBalance: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export function SupplierForm({ initialData }: { initialData?: SupplierFormInitialData }) {
  const router = useRouter();
  const isEditing = Boolean(initialData?.id);
  const [form, setForm] = React.useState<SupplierFormInitialData>(
    initialData ?? {
      name: '',
      phone: '',
      address: '',
      notes: '',
      openingBalance: 0,
      status: 'ACTIVE',
    }
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Supplier name and phone number are required.');
      return;
    }
    setSaving(true);
    try {
      const url = isEditing ? `/api/suppliers/${initialData!.id}` : '/api/suppliers';
      const method = isEditing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save supplier.');
        setSaving(false);
        return;
      }
      toast.success(isEditing ? 'Supplier updated' : 'Supplier created');
      router.push('/suppliers');
      router.refresh();
    } catch {
      setError('Network error while saving supplier.');
      setSaving(false);
    }
  }

  return (
    <FormPageShell
      title={isEditing ? `Edit Supplier: ${initialData?.name}` : 'Add New Supplier'}
      subtitle="Configure vendor contact information and opening payable balance."
      backHref="/suppliers"
      backLabel="Back to Suppliers"
      submitLabel={isEditing ? 'Update Supplier' : 'Save Supplier'}
      saving={saving}
      formId="supplier-form"
    >
      <form id="supplier-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Supplier Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sup-name" required>
                Supplier / Company Name
              </Label>
              <Input
                id="sup-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., Hall Road IT Imports"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-phone" required>
                Phone Number
              </Label>
              <Input
                id="sup-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="03XX-XXXXXXX"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-opening">Opening Payable Balance (PKR)</Label>
              <Input
                id="sup-opening"
                type="number"
                min={0}
                value={form.openingBalance}
                onChange={(e) => setForm({ ...form, openingBalance: Number(e.target.value) })}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-status">Status</Label>
              <select
                id="sup-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sup-address">Address</Label>
              <Input
                id="sup-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Market / Shop address"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="sup-notes">Notes</Label>
              <Textarea
                id="sup-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Payment terms, specialties, or remarks..."
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </FormPageShell>
  );
}
