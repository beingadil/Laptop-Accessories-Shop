'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { FormPageShell } from '@/components/forms/FormPageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DatePicker } from '@/components/ui/date-picker';
import { formatDate, formatDateInput, formatPKR } from '@/lib/format';

interface SaleSummaryOption {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  totalAmount: number;
  status: string;
  walkInCustomerName: string | null;
  customer: { id: string; name: string; phone: string } | null;
}

interface SaleItemDetail {
  id: string;
  productId: string;
  quantity: number;
  returnedQuantity: number;
  unitPrice: number;
  unitCost: number;
  totalAmount: number;
  product: {
    id: string;
    name: string;
    sku: string;
    inventoryType: 'SERIALIZED' | 'QUANTITY';
  };
  serializedItem: {
    id: string;
    serialNumber: string;
    condition: string;
  } | null;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  inventoryType: 'SERIALIZED' | 'QUANTITY';
  sellingPrice: number;
  currentStock: number;
  serializedItems: Array<{
    id: string;
    serialNumber: string;
    sellingPrice: number;
    condition: string;
  }>;
}

interface ReturnSelectionState {
  selected: boolean;
  quantity: number;
  restockStatus: 'RESTOCKED' | 'DAMAGED';
  condition: string;
  refundAmount: number;
}

interface ReplacementDraft {
  key: string;
  productId: string;
  serializedItemId: string;
  quantity: number;
  unitPrice: number;
}

function ProcessExchangeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSaleId = searchParams.get('saleId') || '';

  const [salesList, setSalesList] = React.useState<SaleSummaryOption[]>([]);
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [selectedSaleId, setSelectedSaleId] = React.useState(preselectedSaleId);
  const [saleItems, setSaleItems] = React.useState<SaleItemDetail[]>([]);
  const [loadingSale, setLoadingSale] = React.useState(false);

  const [returnDate, setReturnDate] = React.useState(formatDateInput(new Date()));
  const [reason, setReason] = React.useState<'DEFECTIVE' | 'CHANGED_MIND' | 'WRONG_PRODUCT' | 'OTHER'>('DEFECTIVE');
  const [notes, setNotes] = React.useState('');
  const [selections, setSelections] = React.useState<Record<string, ReturnSelectionState>>({});
  const [replacements, setReplacements] = React.useState<ReplacementDraft[]>([
    { key: 'rep-1', productId: '', serializedItemId: '', quantity: 1, unitPrice: 0 },
  ]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    Promise.all([
      fetch('/api/sales?pageSize=100').then((r) => r.json()),
      fetch('/api/products?all=1&inStockOnly=1').then((r) => r.json()),
    ])
      .then(([salesRes, prodRes]) => {
        const eligible = (salesRes.items || []).filter(
          (s: SaleSummaryOption) => s.status !== 'RETURNED' && s.status !== 'CANCELLED'
        );
        setSalesList(eligible);
        setProducts(prodRes.items || []);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!selectedSaleId) {
        if (active) {
          setSaleItems([]);
          setSelections({});
        }
        return;
      }
      setLoadingSale(true);
      fetch(`/api/sales/${selectedSaleId}`)
        .then((r) => r.json())
        .then((d) => {
          if (active && d.sale) {
            setSaleItems(d.sale.items || []);
            const init: Record<string, ReturnSelectionState> = {};
            for (const item of d.sale.items as SaleItemDetail[]) {
              const remaining = item.quantity - item.returnedQuantity;
              const unitNet = item.quantity > 0 ? item.totalAmount / item.quantity : item.unitPrice;
              init[item.id] = {
                selected: false,
                quantity: Math.max(1, remaining),
                restockStatus: 'RESTOCKED',
                condition: item.serializedItem?.condition || 'Good',
                refundAmount: Math.round(unitNet * Math.max(1, remaining)),
              };
            }
            setSelections(init);
          }
        })
        .catch(() => toast.error('Failed to load sale items.'))
        .finally(() => {
          if (active) setLoadingSale(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedSaleId]);

  const productMap = React.useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const activeReturned = React.useMemo(() => {
    return saleItems
      .filter((it) => selections[it.id]?.selected && it.quantity - it.returnedQuantity > 0)
      .map((it) => ({ item: it, sel: selections[it.id] }));
  }, [saleItems, selections]);

  const returnedValue = activeReturned.reduce((sum, r) => sum + (r.sel.refundAmount || 0), 0);
  const replacementValue = replacements.reduce(
    (sum, r) => sum + (r.productId ? r.quantity * r.unitPrice : 0),
    0
  );
  const priceDifference = replacementValue - returnedValue;

  function updateReturnLine(saleItemId: string, patch: Partial<ReturnSelectionState>, item: SaleItemDetail) {
    setSelections((prev) => {
      const cur = prev[saleItemId];
      if (!cur) return prev;
      const next = { ...cur, ...patch };
      if (patch.quantity !== undefined) {
        const unitNet = item.quantity > 0 ? item.totalAmount / item.quantity : item.unitPrice;
        next.refundAmount = Math.round(unitNet * next.quantity);
      }
      return { ...prev, [saleItemId]: next };
    });
  }

  function updateReplacement(key: string, patch: Partial<ReplacementDraft>) {
    setReplacements((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function handleSelectReplacementProduct(key: string, productId: string) {
    const prod = productMap.get(productId);
    updateReplacement(key, {
      productId,
      serializedItemId: '',
      quantity: 1,
      unitPrice: prod ? prod.sellingPrice : 0,
    });
  }

  function handleSelectReplacementSerial(key: string, productId: string, serialId: string) {
    const prod = productMap.get(productId);
    const serial = prod?.serializedItems.find((s) => s.id === serialId);
    updateReplacement(key, {
      serializedItemId: serialId,
      quantity: 1,
      unitPrice: serial?.sellingPrice || prod?.sellingPrice || 0,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedSaleId) {
      setError('Please select the original invoice.');
      return;
    }
    if (activeReturned.length === 0) {
      setError('Select at least one item being returned.');
      return;
    }

    const validReplacements = replacements.filter((r) => Boolean(r.productId));
    if (validReplacements.length === 0) {
      setError('Select at least one replacement product.');
      return;
    }

    for (const rep of validReplacements) {
      const prod = productMap.get(rep.productId);
      if (prod?.inventoryType === 'SERIALIZED' && !rep.serializedItemId) {
        setError(`Please select a serial number for replacement ${prod.name}.`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'EXCHANGE',
          originalSaleId: selectedSaleId,
          returnDate,
          reason,
          notes: notes.trim() || null,
          returnedItems: activeReturned.map(({ item, sel }) => ({
            saleItemId: item.id,
            quantity: sel.quantity,
            restockStatus: sel.restockStatus,
            condition: sel.condition.trim() || null,
            refundAmount: sel.refundAmount,
          })),
          replacementItems: validReplacements.map((r) => ({
            productId: r.productId,
            serializedItemId: r.serializedItemId || null,
            quantity: r.quantity,
            unitPrice: r.unitPrice,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Could not process exchange.');
        return;
      }
      toast.success(`Exchange ${json.returnNumber} completed.`);
      router.push('/returns');
      router.refresh();
    } catch {
      setError('Network error while processing exchange.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormPageShell
      title="Process Item Exchange"
      subtitle="Accept returned items from an existing invoice and issue replacement products with automatic cash difference calculation."
      backHref="/returns"
      backLabel="Back to Returns"
      submitLabel="Complete Exchange"
      saving={saving}
      formId="process-exchange-form"
    >
      <form id="process-exchange-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>1. Original Invoice &amp; Exchange Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label>
                Original Sale Invoice <span className="text-red-500">*</span>
              </Label>
              <SearchableSelect
                options={salesList.map((s) => ({
                  value: s.id,
                  label: `${s.invoiceNumber} — ${s.customer?.name || s.walkInCustomerName || 'Walk-in'}`,
                  sublabel: `${formatDate(s.saleDate)} · ${formatPKR(s.totalAmount)}`,
                }))}
                value={selectedSaleId}
                onChange={setSelectedSaleId}
                placeholder="Search by invoice # or customer..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exchange-date">
                Exchange Date <span className="text-red-500">*</span>
              </Label>
              <DatePicker
                id="exchange-date"
                value={returnDate}
                onChange={setReturnDate}
                ariaLabel="Exchange Date"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exchange-reason">Reason</Label>
              <select
                id="exchange-reason"
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value as 'DEFECTIVE' | 'CHANGED_MIND' | 'WRONG_PRODUCT' | 'OTHER')
                }
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="DEFECTIVE">Defective / Upgrade</option>
                <option value="CHANGED_MIND">Customer Preference</option>
                <option value="WRONG_PRODUCT">Wrong Specification</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="exchange-notes">Exchange Notes</Label>
              <Textarea
                id="exchange-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes regarding the swap..."
              />
            </div>
          </CardContent>
        </Card>

        {selectedSaleId && (
          <Card>
            <CardHeader>
              <CardTitle>2. Returned Items from Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingSale ? (
                <p className="text-sm text-slate-500">Loading invoice items...</p>
              ) : (
                saleItems.map((item) => {
                  const remaining = item.quantity - item.returnedQuantity;
                  const sel = selections[item.id];
                  if (!sel) return null;
                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 ${
                        sel.selected ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          disabled={remaining <= 0}
                          checked={sel.selected}
                          onChange={(e) =>
                            updateReturnLine(item.id, { selected: e.target.checked }, item)
                          }
                          className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                        />
                        <div>
                          <div className="font-medium text-slate-900">
                            {item.product.name}
                            {item.serializedItem && (
                              <span className="ml-2 font-mono text-xs text-blue-700">
                                SN: {item.serializedItem.serialNumber}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            Returnable: {remaining} · Sold Value: {formatPKR(item.totalAmount)}
                          </div>
                        </div>
                      </label>

                      {sel.selected && remaining > 0 && (
                        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Return Qty</Label>
                            <Input
                              type="number"
                              min={1}
                              max={remaining}
                              disabled={item.product.inventoryType === 'SERIALIZED'}
                              value={sel.quantity}
                              onChange={(e) =>
                                updateReturnLine(
                                  item.id,
                                  { quantity: Math.max(1, Math.min(remaining, Number(e.target.value) || 1)) },
                                  item
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Stock Condition</Label>
                            <select
                              value={sel.restockStatus}
                              onChange={(e) =>
                                updateReturnLine(
                                  item.id,
                                  { restockStatus: e.target.value as 'RESTOCKED' | 'DAMAGED' },
                                  item
                                )
                              }
                              className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm"
                            >
                              <option value="RESTOCKED">Restock (Sellable)</option>
                              <option value="DAMAGED">Damaged / Defective</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Return Credit Value (PKR)</Label>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={sel.refundAmount}
                              onChange={(e) =>
                                updateReturnLine(
                                  item.id,
                                  { refundAmount: Math.max(0, Number(e.target.value) || 0) },
                                  item
                                )
                              }
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>3. Replacement Items Issued to Customer</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setReplacements((prev) => [
                  ...prev,
                  {
                    key: `rep-${Date.now()}`,
                    productId: '',
                    serializedItemId: '',
                    quantity: 1,
                    unitPrice: 0,
                  },
                ])
              }
            >
              <Plus className="h-3.5 w-3.5" />
              Add Replacement Item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {replacements.map((rep) => {
              const prod = productMap.get(rep.productId);
              const isSerialized = prod?.inventoryType === 'SERIALIZED';
              return (
                <div
                  key={rep.key}
                  className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 md:grid-cols-12 md:items-end"
                >
                  <div className="space-y-1.5 md:col-span-5">
                    <Label className="text-xs">Replacement Product</Label>
                    <SearchableSelect
                      options={products.map((p) => ({
                        value: p.id,
                        label: p.name,
                        sublabel: `${p.sku} · Stock: ${p.currentStock} · ${formatPKR(p.sellingPrice)}`,
                      }))}
                      value={rep.productId}
                      onChange={(val) => handleSelectReplacementProduct(rep.key, val)}
                      placeholder="Select in-stock product..."
                    />
                  </div>

                  {isSerialized ? (
                    <div className="space-y-1.5 md:col-span-4">
                      <Label className="text-xs">Serial Number</Label>
                      <SearchableSelect
                        options={(prod?.serializedItems || []).map((s) => ({
                          value: s.id,
                          label: s.serialNumber,
                          sublabel: `${s.condition} · ${formatPKR(s.sellingPrice)}`,
                        }))}
                        value={rep.serializedItemId}
                        onChange={(val) => handleSelectReplacementSerial(rep.key, rep.productId, val)}
                        placeholder="Select serial #..."
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs">Qty (Avail: {prod?.currentStock ?? 0})</Label>
                      <Input
                        type="number"
                        min={1}
                        max={prod?.currentStock || 999}
                        value={rep.quantity}
                        onChange={(e) =>
                          updateReplacement(rep.key, { quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                    </div>
                  )}

                  <div className={`space-y-1.5 ${isSerialized ? 'md:col-span-2' : 'md:col-span-4'}`}>
                    <Label className="text-xs">Unit Price (PKR)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="any"
                      value={rep.unitPrice}
                      onChange={(e) =>
                        updateReplacement(rep.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                      }
                    />
                  </div>

                  <div className="md:col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={replacements.length <= 1}
                      onClick={() =>
                        setReplacements((prev) => prev.filter((item) => item.key !== rep.key))
                      }
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-slate-500">Returned Credit Value</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                {formatPKR(returnedValue)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Replacement Value</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">
                {formatPKR(replacementValue)}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">
                {priceDifference > 0
                  ? 'Customer Pays Extra (Cash)'
                  : priceDifference < 0
                  ? 'Refund to Customer (Cash)'
                  : 'Even Exchange'}
              </p>
              <p
                className={`mt-1 text-xl font-semibold tabular-nums ${
                  priceDifference > 0
                    ? 'text-emerald-700'
                    : priceDifference < 0
                    ? 'text-red-700'
                    : 'text-slate-900'
                }`}
              >
                {formatPKR(Math.abs(priceDifference))}
              </p>
            </div>
          </CardContent>
        </Card>
      </form>
    </FormPageShell>
  );
}

export default function ExchangePage() {
  return (
    <AppShell pageTitle="Process Exchange">
      <React.Suspense
        fallback={
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading exchange form...
          </div>
        }
      >
        <ProcessExchangeContent />
      </React.Suspense>
    </AppShell>
  );
}
