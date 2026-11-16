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
import { calculateSaleTotals } from '@/lib/domain/calculations';

interface SerialOption {
  id: string;
  serialNumber: string;
  purchasePrice: number;
  sellingPrice: number;
  condition: string;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  inventoryType: 'SERIALIZED' | 'QUANTITY';
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  serializedItems: SerialOption[];
}

interface CustomerOption {
  id: string;
  name: string;
  phone: string;
}

export interface SaleLineDraft {
  key: string;
  productId: string;
  serializedItemId: string;
  serializedLabel?: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  discount: number;
  warrantyMonths: number;
}

export interface SaleFormInitialData {
  id?: string;
  invoiceNumber: string;
  customerId: string;
  walkInCustomerName: string;
  walkInCustomerPhone: string;
  saleDate: string;
  discount: number;
  notes: string;
  items: SaleLineDraft[];
}

export function SaleForm({ initialData }: { initialData?: SaleFormInitialData }) {
  const router = useRouter();
  const { branding } = useBranding();
  const isEditing = Boolean(initialData?.id);

  const [customers, setCustomers] = React.useState<CustomerOption[]>([]);
  const [products, setProducts] = React.useState<ProductOption[]>([]);

  const [invoiceNumber, setInvoiceNumber] = React.useState(initialData?.invoiceNumber || '');
  const [customerId, setCustomerId] = React.useState(initialData?.customerId || '');
  const [walkInCustomerName, setWalkInCustomerName] = React.useState(
    initialData?.walkInCustomerName || ''
  );
  const [walkInCustomerPhone, setWalkInCustomerPhone] = React.useState(
    initialData?.walkInCustomerPhone || ''
  );
  const [saleDate, setSaleDate] = React.useState(
    initialData?.saleDate || formatDateInput(new Date())
  );
  const [invoiceDiscount, setInvoiceDiscount] = React.useState(initialData?.discount ?? 0);
  const [notes, setNotes] = React.useState(initialData?.notes || '');
  const [lines, setLines] = React.useState<SaleLineDraft[]>(
    initialData?.items || [
      {
        key: 'sale-line-1',
        productId: '',
        serializedItemId: '',
        quantity: 1,
        unitPrice: 0,
        unitCost: 0,
        discount: 0,
        warrantyMonths: 1,
      },
    ]
  );

  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    Promise.all([
      fetch('/api/customers?all=1').then((r) => r.json()),
      fetch('/api/products?all=1').then((r) => r.json()),
    ]).then(([custRes, prodRes]) => {
      setCustomers(custRes.items || []);
      setProducts(prodRes.items || []);
    });
  }, []);

  const productMap = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const totals = React.useMemo(
    () =>
      calculateSaleTotals(
        lines.map((l) => ({
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          unitCost: l.unitCost,
          discount: l.discount,
        })),
        invoiceDiscount
      ),
    [lines, invoiceDiscount]
  );

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        key: `sale-line-${Date.now()}-${prev.length}`,
        productId: '',
        serializedItemId: '',
        quantity: 1,
        unitPrice: 0,
        unitCost: 0,
        discount: 0,
        warrantyMonths: 0,
      },
    ]);
  }

  function removeLine(key: string) {
    if (lines.length <= 1) return;
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function updateLine(key: string, patch: Partial<SaleLineDraft>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l;
        const next = { ...l, ...patch };
        if (patch.productId !== undefined) {
          const prod = productMap.get(patch.productId);
          if (prod) {
            next.serializedItemId = '';
            next.quantity = 1;
            next.unitPrice = prod.sellingPrice;
            next.unitCost = prod.purchasePrice;
            next.warrantyMonths = prod.inventoryType === 'SERIALIZED' ? 1 : 0;
          }
        }
        if (patch.serializedItemId !== undefined) {
          const prod = productMap.get(next.productId);
          const serial = prod?.serializedItems.find((s) => s.id === patch.serializedItemId);
          if (serial) {
            next.unitPrice = serial.sellingPrice;
            next.unitCost = serial.purchasePrice;
            next.quantity = 1;
          }
        }
        return next;
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const usedSerialIds = new Set<string>();
    for (const line of lines) {
      const prod = productMap.get(line.productId);
      if (!prod) {
        setError('Please select a product on every line.');
        return;
      }
      if (prod.inventoryType === 'SERIALIZED') {
        if (!line.serializedItemId) {
          setError(`Please select a serial number for ${prod.name}.`);
          return;
        }
        if (usedSerialIds.has(line.serializedItemId)) {
          setError('Cannot select the same serial number twice on the same invoice.');
          return;
        }
        usedSerialIds.add(line.serializedItemId);
      } else if (line.quantity <= 0) {
        setError(`Quantity for ${prod.name} must be at least 1.`);
        return;
      }
    }

    setSaving(true);
    try {
      const url = isEditing ? `/api/sales/${initialData!.id}` : '/api/sales';
      const method = isEditing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceNumber: invoiceNumber.trim() || undefined,
          customerId: customerId || null,
          walkInCustomerName: customerId ? null : walkInCustomerName.trim() || 'Walk-in Customer',
          walkInCustomerPhone: customerId ? null : walkInCustomerPhone.trim() || null,
          saleDate,
          discount: invoiceDiscount,
          paymentMethod: 'CASH',
          notes,
          items: lines.map((l) => ({
            productId: l.productId,
            serializedItemId: l.serializedItemId || null,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            discount: l.discount,
            warrantyMonths: l.warrantyMonths,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save sale invoice.');
        setSaving(false);
        return;
      }
      toast.success(isEditing ? 'Sale invoice updated' : 'Sale invoice created successfully');
      router.push(`/sales/${data.id}/invoice`);
      router.refresh();
    } catch {
      setError('Network error while saving sale.');
      setSaving(false);
    }
  }

  // Serials selected on other lines so user sees only unused serials
  const selectedSerialIdsAll = new Set(lines.map((l) => l.serializedItemId).filter(Boolean));

  return (
    <FormPageShell
      title={isEditing ? `Edit Invoice ${initialData?.invoiceNumber}` : 'New Sales Invoice'}
      subtitle="Select products or individual serial numbers, apply discounts, set warranty, and generate an A4 cash invoice."
      backHref="/sales"
      backLabel="Back to Sales"
      submitLabel={isEditing ? 'Update Invoice' : 'Save & Generate Invoice'}
      saving={saving}
      formId="sale-form"
    >
      <form id="sale-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Invoice & Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="sale-inv">Invoice Number (auto if blank)</Label>
              <Input
                id="sale-inv"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder={`Auto ${branding.invoicePrefix}XXXX`}
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sale-date" required>
                Sale Date
              </Label>
              <DatePicker
                id="sale-date"
                value={saleDate}
                onChange={setSaleDate}
                ariaLabel="Sale Date"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sale-method">Payment Method</Label>
              <Input id="sale-method" value="CASH (Paid)" disabled />
            </div>

            <div className="space-y-1.5 sm:col-span-3">
              <Label>Customer (Optional — leave empty for Walk-in Customer)</Label>
              <SearchableSelect
                options={customers.map((c) => ({
                  value: c.id,
                  label: c.name,
                  sublabel: c.phone,
                }))}
                value={customerId}
                onChange={setCustomerId}
                placeholder="Select saved customer or leave blank for Walk-in..."
              />
            </div>

            {!customerId && (
              <>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="walkin-name">Walk-in Customer Name</Label>
                  <Input
                    id="walkin-name"
                    value={walkInCustomerName}
                    onChange={(e) => setWalkInCustomerName(e.target.value)}
                    placeholder="Walk-in Customer"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="walkin-phone">Walk-in Phone (Optional)</Label>
                  <Input
                    id="walkin-phone"
                    value={walkInCustomerPhone}
                    onChange={(e) => setWalkInCustomerPhone(e.target.value)}
                    placeholder="03XX-XXXXXXX"
                    className="font-mono"
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Invoice Line Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" />
              Add Product Line
            </Button>
          </CardHeader>
          <CardContent className="divide-y divide-slate-200">
            {lines.map((line, idx) => {
              const prod = productMap.get(line.productId);
              const isSerialized = prod?.inventoryType === 'SERIALIZED';

              const serialOptions = (prod?.serializedItems || [])
                .filter((s) => s.id === line.serializedItemId || !selectedSerialIdsAll.has(s.id))
                .map((s) => ({
                  value: s.id,
                  label: s.serialNumber,
                  sublabel: `${s.condition} · Price: ${formatPKR(s.sellingPrice)}`,
                }));

              // Include current edited serial if it was previously marked SOLD on this sale
              if (
                isEditing &&
                line.serializedItemId &&
                line.serializedLabel &&
                !serialOptions.some((o) => o.value === line.serializedItemId)
              ) {
                serialOptions.unshift({
                  value: line.serializedItemId,
                  label: line.serializedLabel,
                  sublabel: 'Current invoice unit',
                });
              }

              const lineNet = Math.max(0, line.quantity * line.unitPrice - line.discount);

              return (
                <div
                  key={line.key}
                  className="py-4 first:pt-0 last:pb-0 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-600">Line #{idx + 1}</span>
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
                          sublabel: `${p.sku} · Stock: ${p.currentStock} · ${formatPKR(p.sellingPrice)}`,
                        }))}
                        value={line.productId}
                        onChange={(val) => updateLine(line.key, { productId: val })}
                        placeholder="Search product..."
                      />
                    </div>

                    {isSerialized ? (
                      <div className="sm:col-span-4 space-y-1">
                        <Label required>Serial Number</Label>
                        <SearchableSelect
                          options={serialOptions}
                          value={line.serializedItemId}
                          onChange={(val) => updateLine(line.key, { serializedItemId: val })}
                          placeholder="Select serial number..."
                          emptyMessage="No in-stock serials available"
                        />
                      </div>
                    ) : (
                      <div className="sm:col-span-2 space-y-1">
                        <Label required>Qty (Avail: {prod?.currentStock ?? 0})</Label>
                        <Input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                          className="tabular-nums"
                        />
                      </div>
                    )}

                    <div className={isSerialized ? 'sm:col-span-3 space-y-1' : 'sm:col-span-2 space-y-1'}>
                      <Label required>Unit Price (PKR)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: Number(e.target.value) })}
                        className="tabular-nums"
                      />
                    </div>

                    {!isSerialized && (
                      <div className="sm:col-span-3 space-y-1">
                        <Label>Line Discount / Warranty (Mo)</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            min={0}
                            value={line.discount}
                            onChange={(e) => updateLine(line.key, { discount: Number(e.target.value) })}
                            placeholder="Disc"
                            aria-label="Line discount"
                            className="tabular-nums"
                          />
                          <Input
                            type="number"
                            min={0}
                            max={60}
                            value={line.warrantyMonths}
                            onChange={(e) =>
                              updateLine(line.key, { warrantyMonths: Number(e.target.value) })
                            }
                            placeholder="Mo"
                            aria-label="Warranty months"
                            className="w-20 tabular-nums"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {isSerialized && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1">
                      <div className="space-y-1">
                        <Label>Line Discount (PKR)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={line.discount}
                          onChange={(e) => updateLine(line.key, { discount: Number(e.target.value) })}
                          className="tabular-nums bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Warranty Duration (Months)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={60}
                          value={line.warrantyMonths}
                          onChange={(e) =>
                            updateLine(line.key, { warrantyMonths: Number(e.target.value) })
                          }
                          className="tabular-nums bg-white"
                        />
                      </div>
                      <div className="flex items-end justify-end">
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Line Total</div>
                          <div className="text-base font-bold font-mono text-slate-900">
                            {formatPKR(lineNet)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {!isSerialized && (
                    <div className="flex justify-end text-xs text-slate-600">
                      Line Total: <strong className="ml-1.5 font-mono text-slate-900">{formatPKR(lineNet)}</strong>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Totals & Notes</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="sale-disc">Extra Invoice Discount (PKR)</Label>
                <Input
                  id="sale-disc"
                  type="number"
                  min={0}
                  value={invoiceDiscount}
                  onChange={(e) => setInvoiceDiscount(Number(e.target.value))}
                  className="tabular-nums font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sale-notes">Invoice Notes</Label>
                <Textarea
                  id="sale-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional remarks printed on the invoice..."
                />
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 p-4 space-y-2.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono">{formatPKR(totals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Invoice Discount</span>
                <span className="font-mono text-red-600">- {formatPKR(totals.invoiceDiscount)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2.5 flex justify-between text-base font-bold text-slate-900">
                <span>Grand Total (Cash)</span>
                <span className="font-mono">{formatPKR(totals.totalAmount)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 flex justify-between text-xs text-slate-500">
                <span>Estimated Cost / Gross Profit</span>
                <span className="font-mono text-emerald-700 font-medium">
                  Cost {formatPKR(totals.totalCost)} · Profit {formatPKR(totals.grossProfit)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </FormPageShell>
  );
}
