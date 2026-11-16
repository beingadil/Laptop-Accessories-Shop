'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { FormPageShell } from '@/components/forms/FormPageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DatePicker } from '@/components/ui/date-picker';
import { useBranding } from '@/components/branding/BrandingProvider';
import { formatDateInput, formatPKR } from '@/lib/format';

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  inventoryType: 'SERIALIZED' | 'QUANTITY';
  purchasePrice: number;
  sellingPrice: number;
  condition: 'NEW' | 'USED' | 'REFURBISHED';
}

interface SupplierOption {
  id: string;
  name: string;
  phone: string;
  outstandingBalance: number;
}

export interface PurchaseLineDraft {
  key: string;
  productId: string;
  quantity: number;
  unitCost: number;
  condition: 'NEW' | 'USED' | 'REFURBISHED';
  serialsText: string;
}

export interface PurchaseFormInitialData {
  id?: string;
  purchaseNumber: string;
  supplierId: string;
  purchaseDate: string;
  paidAmount: number;
  notes: string;
  items: PurchaseLineDraft[];
}

export function PurchaseForm({ initialData }: { initialData?: PurchaseFormInitialData }) {
  const router = useRouter();
  const { branding } = useBranding();
  const isEditing = Boolean(initialData?.id);

  const [suppliers, setSuppliers] = React.useState<SupplierOption[]>([]);
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [purchaseNumber, setPurchaseNumber] = React.useState(initialData?.purchaseNumber || '');
  const [supplierId, setSupplierId] = React.useState(initialData?.supplierId || '');
  const [purchaseDate, setPurchaseDate] = React.useState(
    initialData?.purchaseDate || formatDateInput(new Date())
  );
  const [paidAmount, setPaidAmount] = React.useState(initialData?.paidAmount ?? 0);
  const [notes, setNotes] = React.useState(initialData?.notes || '');
  const [lines, setLines] = React.useState<PurchaseLineDraft[]>(
    initialData?.items || [
      {
        key: 'line-1',
        productId: '',
        quantity: 1,
        unitCost: 0,
        condition: 'USED',
        serialsText: '',
      },
    ]
  );
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    Promise.all([
      fetch('/api/suppliers?all=1').then((r) => r.json()),
      fetch('/api/products?all=1').then((r) => r.json()),
    ]).then(([supRes, prodRes]) => {
      setSuppliers(supRes.items || []);
      setProducts(prodRes.items || []);
    });
  }, []);

  const productMap = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const totalAmount = lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
  const outstandingAmount = Math.max(0, totalAmount - paidAmount);

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: `line-${Date.now()}-${prev.length}`,
        productId: '',
        quantity: 1,
        unitCost: 0,
        condition: 'USED',
        serialsText: '',
      },
    ]);
  }

  function removeLine(key: string) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function updateLine(key: string, patch: Partial<PurchaseLineDraft>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.productId !== undefined) {
          const prod = productMap.get(patch.productId);
          if (prod) {
            next.unitCost = prod.purchasePrice;
            next.condition = prod.condition;
          }
        }
        if (patch.serialsText !== undefined) {
          const prod = productMap.get(next.productId);
          if (prod?.inventoryType === 'SERIALIZED') {
            const count = patch.serialsText
              .split(/[\n,]+/)
              .map((s) => s.trim())
              .filter(Boolean).length;
            if (count > 0) next.quantity = count;
          }
        }
        return next;
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!supplierId) {
      setError('Please select a supplier.');
      return;
    }

    const payloadItems = [];
    for (const line of lines) {
      const prod = productMap.get(line.productId);
      if (!prod) {
        setError('Please select a product for every row.');
        return;
      }
      if (prod.inventoryType === 'SERIALIZED') {
        const serials = line.serialsText
          .split(/[\n,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (serials.length !== line.quantity) {
          setError(
            `${prod.name} requires ${line.quantity} serial number(s), but ${serials.length} were entered.`
          );
          return;
        }
        payloadItems.push({
          productId: line.productId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          condition: line.condition,
          serialNumbers: serials,
        });
      } else {
        payloadItems.push({
          productId: line.productId,
          quantity: line.quantity,
          unitCost: line.unitCost,
          condition: line.condition,
        });
      }
    }

    if (paidAmount > totalAmount) {
      setError('Paid amount cannot exceed purchase total.');
      return;
    }

    setSaving(true);
    try {
      const url = isEditing ? `/api/purchases/${initialData!.id}` : '/api/purchases';
      const method = isEditing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseNumber: purchaseNumber.trim() || undefined,
          supplierId,
          purchaseDate,
          paidAmount,
          notes,
          items: payloadItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save purchase.');
        setSaving(false);
        return;
      }
      toast.success(isEditing ? 'Purchase updated and stock synced' : 'Purchase recorded and stock increased');
      router.push(`/purchases/${data.id}`);
      router.refresh();
    } catch {
      setError('Network error while saving purchase.');
      setSaving(false);
    }
  }

  return (
    <FormPageShell
      title={isEditing ? `Edit Purchase ${initialData?.purchaseNumber}` : 'New Stock Purchase'}
      subtitle="Record supplier purchase, enter laptop/Chromebook serial numbers, and update stock & supplier balance."
      backHref="/purchases"
      backLabel="Back to Purchases"
      submitLabel={isEditing ? 'Update Purchase' : 'Complete Purchase'}
      saving={saving}
      formId="purchase-form"
    >
      <form id="purchase-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Purchase Header</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label required>Supplier</Label>
              <SearchableSelect
                options={suppliers.map((s) => ({
                  value: s.id,
                  label: s.name,
                  sublabel: `${s.phone} · Due: ${formatPKR(s.outstandingBalance)}`,
                }))}
                value={supplierId}
                onChange={setSupplierId}
                placeholder="Search supplier..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pur-date" required>
                Purchase Date
              </Label>
              <DatePicker
                id="pur-date"
                value={purchaseDate}
                onChange={setPurchaseDate}
                ariaLabel="Purchase Date"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="pur-num">Purchase Number (auto if blank)</Label>
              <Input
                id="pur-num"
                value={purchaseNumber}
                onChange={(e) => setPurchaseNumber(e.target.value)}
                placeholder={`Auto-generated ${branding.purchasePrefix}XXXX`}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="pur-notes">Purchase Notes</Label>
              <Input
                id="pur-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Supplier bill reference or delivery details..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Purchased Products</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" />
              Add Item Row
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-slate-200">
            {lines.map((line, idx) => {
              const prod = productMap.get(line.productId);
              const isSerialized = prod?.inventoryType === 'SERIALIZED';
              return (
                <div
                  key={line.key}
                  className="py-4 first:pt-0 last:pb-0 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Item #{idx + 1}</span>
                    {lines.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLine(line.key)}
                        className="text-red-600 hover:text-red-700 h-7 px-2"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
                    <div className="sm:col-span-5 space-y-1">
                      <Label required>Product</Label>
                      <SearchableSelect
                        options={products.map((p) => ({
                          value: p.id,
                          label: p.name,
                          sublabel: `${p.sku} · ${p.inventoryType}`,
                        }))}
                        value={line.productId}
                        onChange={(val) => updateLine(line.key, { productId: val })}
                        placeholder="Select product..."
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <Label required>Quantity</Label>
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                        className="tabular-nums"
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <Label required>Unit Cost (PKR)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={line.unitCost}
                        onChange={(e) => updateLine(line.key, { unitCost: Number(e.target.value) })}
                        className="tabular-nums"
                      />
                    </div>

                    <div className="sm:col-span-3 space-y-1">
                      <Label>Condition & Line Total</Label>
                      <div className="flex items-center gap-2">
                        <select
                          value={line.condition}
                          onChange={(e) =>
                            updateLine(line.key, {
                              condition: e.target.value as 'NEW' | 'USED' | 'REFURBISHED',
                            })
                          }
                          aria-label="Item condition"
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs"
                        >
                          <option value="NEW">New</option>
                          <option value="USED">Used</option>
                          <option value="REFURBISHED">Refurbished</option>
                        </select>
                        <div className="flex-1 text-right font-mono text-sm font-semibold text-slate-900">
                          {formatPKR(line.quantity * line.unitCost)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isSerialized && (
                    <div className="space-y-1">
                      <Label required>
                        Serial Numbers (enter {line.quantity} serial number(s), one per line or comma-separated)
                      </Label>
                      <Textarea
                        rows={2}
                        value={line.serialsText}
                        onChange={(e) => updateLine(line.key, { serialsText: e.target.value })}
                        placeholder="SN-001, SN-002..."
                        className="font-mono text-xs bg-white"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Purchase Total</div>
              <div className="text-xl font-bold font-mono text-slate-900">{formatPKR(totalAmount)}</div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pur-paid">Cash Paid Now (PKR)</Label>
              <Input
                id="pur-paid"
                type="number"
                min={0}
                max={totalAmount}
                value={paidAmount}
                onChange={(e) => setPaidAmount(Number(e.target.value))}
                className="tabular-nums font-mono"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Outstanding Added to Supplier Balance</div>
              <div className="text-xl font-bold font-mono text-amber-700">
                {formatPKR(outstandingAmount)}
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </FormPageShell>
  );
}
