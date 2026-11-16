'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { FormPageShell } from '@/components/forms/FormPageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  discount: number;
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

interface SaleDetail {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  totalAmount: number;
  walkInCustomerName: string | null;
  customer: { id: string; name: string; phone: string } | null;
  items: SaleItemDetail[];
}

interface ReturnSelectionState {
  selected: boolean;
  quantity: number;
  restockStatus: 'RESTOCKED' | 'DAMAGED';
  condition: string;
  refundAmount: number;
}

function ProcessReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSaleId = searchParams.get('saleId') || '';

  const [salesList, setSalesList] = React.useState<SaleSummaryOption[]>([]);
  const [selectedSaleId, setSelectedSaleId] = React.useState(preselectedSaleId);
  const [saleDetail, setSaleDetail] = React.useState<SaleDetail | null>(null);
  const [loadingSale, setLoadingSale] = React.useState(false);

  const [returnDate, setReturnDate] = React.useState(formatDateInput(new Date()));
  const [reason, setReason] = React.useState<'DEFECTIVE' | 'CHANGED_MIND' | 'WRONG_PRODUCT' | 'OTHER'>('DEFECTIVE');
  const [notes, setNotes] = React.useState('');
  const [selections, setSelections] = React.useState<Record<string, ReturnSelectionState>>({});
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    fetch('/api/sales?pageSize=100')
      .then((r) => r.json())
      .then((d) => {
        const eligible = (d.items || []).filter(
          (s: SaleSummaryOption) => s.status !== 'RETURNED' && s.status !== 'CANCELLED'
        );
        setSalesList(eligible);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (!selectedSaleId) {
        if (active) {
          setSaleDetail(null);
          setSelections({});
        }
        return;
      }
      setLoadingSale(true);
      fetch(`/api/sales/${selectedSaleId}`)
        .then((r) => r.json())
        .then((d) => {
          if (active && d.sale) {
            setSaleDetail(d.sale);
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
        .catch(() => toast.error('Failed to load invoice items.'))
        .finally(() => {
          if (active) setLoadingSale(false);
        });
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [selectedSaleId]);

  function updateLine(saleItemId: string, patch: Partial<ReturnSelectionState>, item: SaleItemDetail) {
    setSelections((prev) => {
      const current = prev[saleItemId];
      if (!current) return prev;
      const next = { ...current, ...patch };
      if (patch.quantity !== undefined) {
        const unitNet = item.quantity > 0 ? item.totalAmount / item.quantity : item.unitPrice;
        next.refundAmount = Math.round(unitNet * next.quantity);
      }
      return { ...prev, [saleItemId]: next };
    });
  }

  const activeReturnItems = React.useMemo(() => {
    if (!saleDetail) return [];
    return saleDetail.items
      .filter((it) => {
        const sel = selections[it.id];
        return sel?.selected && it.quantity - it.returnedQuantity > 0;
      })
      .map((it) => ({ item: it, sel: selections[it.id] }));
  }, [saleDetail, selections]);

  const totalRefund = activeReturnItems.reduce((sum, entry) => sum + (entry.sel.refundAmount || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedSaleId || !saleDetail) {
      setError('Please select the original sale invoice.');
      return;
    }
    if (activeReturnItems.length === 0) {
      setError('Please select at least one item to return.');
      return;
    }

    for (const { item, sel } of activeReturnItems) {
      const maxQty = item.quantity - item.returnedQuantity;
      if (sel.quantity < 1 || sel.quantity > maxQty) {
        setError(`Invalid return quantity for ${item.product.name} (max ${maxQty}).`);
        return;
      }
      if (sel.refundAmount < 0) {
        setError(`Refund amount cannot be negative for ${item.product.name}.`);
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'RETURN',
          originalSaleId: selectedSaleId,
          returnDate,
          reason,
          notes: notes.trim() || null,
          items: activeReturnItems.map(({ item, sel }) => ({
            saleItemId: item.id,
            quantity: sel.quantity,
            restockStatus: sel.restockStatus,
            condition: sel.condition.trim() || null,
            refundAmount: sel.refundAmount,
          })),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Could not process return.');
        return;
      }
      toast.success(`Return ${json.returnNumber} processed successfully.`);
      router.push('/returns');
      router.refresh();
    } catch {
      setError('Network error while processing return.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <FormPageShell
      title="Process Sales Return"
      subtitle="Return sold laptops or accessories back to stock (or mark damaged) and issue cash refund."
      backHref="/returns"
      backLabel="Back to Returns"
      submitLabel="Complete Return"
      saving={saving}
      formId="process-return-form"
    >
      <form id="process-return-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>1. Select Original Invoice &amp; Return Details</CardTitle>
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
              <Label htmlFor="return-date">
                Return Date <span className="text-red-500">*</span>
              </Label>
              <DatePicker
                id="return-date"
                value={returnDate}
                onChange={setReturnDate}
                ariaLabel="Return Date"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="return-reason">
                Return Reason <span className="text-red-500">*</span>
              </Label>
              <select
                id="return-reason"
                value={reason}
                onChange={(e) =>
                  setReason(e.target.value as 'DEFECTIVE' | 'CHANGED_MIND' | 'WRONG_PRODUCT' | 'OTHER')
                }
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <option value="DEFECTIVE">Defective / Hardware Issue</option>
                <option value="CHANGED_MIND">Customer Changed Mind</option>
                <option value="WRONG_PRODUCT">Wrong Product Sold</option>
                <option value="OTHER">Other Reason</option>
              </select>
            </div>

            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="return-notes">Notes</Label>
              <Textarea
                id="return-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional inspection notes or customer remarks..."
              />
            </div>
          </CardContent>
        </Card>

        {selectedSaleId && (
          <Card>
            <CardHeader>
              <CardTitle>2. Select Items to Return</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {loadingSale ? (
                <p className="text-sm text-slate-500 py-4">Loading invoice items...</p>
              ) : !saleDetail || saleDetail.items.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">No items found on this invoice.</p>
              ) : (
                saleDetail.items.map((item) => {
                  const remaining = item.quantity - item.returnedQuantity;
                  const sel = selections[item.id];
                  if (!sel) return null;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-xl border p-4 transition-colors ${
                        sel.selected
                          ? 'border-blue-300 bg-blue-50/40'
                          : 'border-slate-200 bg-white'
                      } ${remaining <= 0 ? 'opacity-60' : ''}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <label className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={remaining <= 0}
                            checked={sel.selected}
                            onChange={(e) =>
                              updateLine(item.id, { selected: e.target.checked }, item)
                            }
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
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
                            <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                              SKU: {item.product.sku} · Sold Qty: {item.quantity} · Returnable: {remaining} · Unit Price: {formatPKR(item.unitPrice)}
                            </div>
                          </div>
                        </label>
                      </div>

                      {sel.selected && remaining > 0 && (
                        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 pt-3 sm:grid-cols-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Return Qty</Label>
                            <Input
                              type="number"
                              min={1}
                              max={remaining}
                              disabled={item.product.inventoryType === 'SERIALIZED'}
                              value={sel.quantity}
                              onChange={(e) =>
                                updateLine(
                                  item.id,
                                  { quantity: Math.max(1, Math.min(remaining, Number(e.target.value) || 1)) },
                                  item
                                )
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Inventory Action</Label>
                            <select
                              value={sel.restockStatus}
                              onChange={(e) =>
                                updateLine(
                                  item.id,
                                  { restockStatus: e.target.value as 'RESTOCKED' | 'DAMAGED' },
                                  item
                                )
                              }
                              className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900"
                            >
                              <option value="RESTOCKED">Restock (Sellable)</option>
                              <option value="DAMAGED">Damaged / Defective</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Returned Condition</Label>
                            <Input
                              value={sel.condition}
                              onChange={(e) =>
                                updateLine(item.id, { condition: e.target.value }, item)
                              }
                              placeholder="e.g. Clean, Scratched"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Cash Refund (PKR)</Label>
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              value={sel.refundAmount}
                              onChange={(e) =>
                                updateLine(
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
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Cash Refund to Customer</p>
              <p className="text-2xl font-semibold text-red-700 tabular-nums">
                {formatPKR(totalRefund)}
              </p>
            </div>
            <p className="text-xs text-slate-500 max-w-md">
              Restocked items will immediately return to available inventory and active warranties for returned items will be voided.
            </p>
          </CardContent>
        </Card>
      </form>
    </FormPageShell>
  );
}

export default function NewReturnPage() {
  return (
    <AppShell pageTitle="Process Return">
      <React.Suspense
        fallback={
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading return form...
          </div>
        }
      >
        <ProcessReturnContent />
      </React.Suspense>
    </AppShell>
  );
}
