'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { FormPageShell } from '@/components/forms/FormPageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { formatDateTime } from '@/lib/format';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  inventoryType: 'SERIALIZED' | 'QUANTITY';
  currentStock: number;
  serializedItems: Array<{ id: string; serialNumber: string }>;
}

interface AdjustmentRow {
  id: string;
  movementType: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  createdAt: string;
  product: { name: string; sku: string };
  serializedItem: { serialNumber: string } | null;
}

export default function StockAdjustmentsPage() {
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [productId, setProductId] = React.useState('');
  const [adjustmentType, setAdjustmentType] = React.useState<
    'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGED' | 'LOST'
  >('DAMAGED');
  const [serializedItemId, setSerializedItemId] = React.useState('');
  const [quantity, setQuantity] = React.useState(1);
  const [reason, setReason] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  // History table state
  const [history, setHistory] = React.useState<AdjustmentRow[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState('');

  const debouncedSearch = useDebouncedValue(search, 150);

  const loadProducts = React.useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/products?all=1', { signal });
      if (res.ok) {
        const d = await res.json();
        setProducts(d.items || []);
      }
    } catch {
      // Ignore abort
    }
  }, []);

  const loadHistory = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoadingHistory(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search: debouncedSearch,
        });
        const res = await fetch(`/api/inventory/adjustments?${params.toString()}`, { signal });
        if (res.ok) {
          const d = await res.json();
          setHistory(d.items || []);
          setTotal(d.total || 0);
          setTotalPages(d.totalPages || 1);
        }
      } catch {
        // Ignore abort
      } finally {
        if (!signal?.aborted) setLoadingHistory(false);
      }
    },
    [page, pageSize, debouncedSearch]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadProducts(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadProducts]);

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadHistory(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadHistory]);

  const selectedProduct = products.find((p) => p.id === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedProduct) {
      setError('Please select a product.');
      return;
    }
    if (!reason.trim()) {
      setError('Please enter a reason for this stock adjustment.');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          adjustmentType,
          quantity: selectedProduct.inventoryType === 'SERIALIZED' ? 1 : quantity,
          serializedItemId:
            selectedProduct.inventoryType === 'SERIALIZED' ? serializedItemId : null,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to record adjustment.');
        setSaving(false);
        return;
      }
      toast.success('Stock adjustment saved');
      setReason('');
      setSerializedItemId('');
      setQuantity(1);
      await Promise.all([loadProducts(), loadHistory()]);
    } catch {
      setError('Network error while saving adjustment.');
    } finally {
      setSaving(false);
    }
  }

  const columns: DataTableColumn<AdjustmentRow>[] = [
    {
      key: 'createdAt',
      header: 'Date',
      render: (r) => <span className="text-xs text-slate-600">{formatDateTime(r.createdAt)}</span>,
    },
    {
      key: 'product',
      header: 'Product',
      render: (r) => (
        <div>
          <div className="font-medium text-slate-900">{r.product.name}</div>
          {r.serializedItem && (
            <div className="text-xs font-mono text-blue-700">SN: {r.serializedItem.serialNumber}</div>
          )}
        </div>
      ),
    },
    {
      key: 'movementType',
      header: 'Adjustment Type',
      render: (r) => <span className="font-mono text-xs font-medium">{r.movementType}</span>,
    },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      render: (r) => <span className="font-mono">{r.quantity}</span>,
    },
    {
      key: 'stockChange',
      header: 'Stock Change',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-xs">
          {r.previousStock} → <strong>{r.newStock}</strong>
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (r) => <span className="text-xs text-slate-600">{r.reason || '—'}</span>,
    },
  ];

  return (
    <AppShell pageTitle="Stock Adjustments">
      <div className="space-y-8">
        <FormPageShell
          title="Stock Adjustment"
          subtitle="Record damaged stock, lost stock, or manual quantity corrections with full audit trail."
          backHref="/inventory"
          backLabel="Back to Inventory"
          submitLabel="Apply Adjustment"
          saving={saving}
          formId="adjustment-form"
        >
          <form id="adjustment-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Adjustment Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label required>Product</Label>
                  <SearchableSelect
                    options={products.map((p) => ({
                      value: p.id,
                      label: p.name,
                      sublabel: `${p.sku} · Stock: ${p.currentStock}`,
                    }))}
                    value={productId}
                    onChange={(val) => {
                      setProductId(val);
                      setSerializedItemId('');
                    }}
                    placeholder="Select product..."
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="adj-type" required>
                    Adjustment Type
                  </Label>
                  <select
                    id="adj-type"
                    value={adjustmentType}
                    onChange={(e) =>
                      setAdjustmentType(
                        e.target.value as 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'DAMAGED' | 'LOST'
                      )
                    }
                    className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="DAMAGED">Damaged Stock (-)</option>
                    <option value="LOST">Lost / Missing Stock (-)</option>
                    <option value="ADJUSTMENT_OUT">Quantity Correction Decrease (-)</option>
                    <option value="ADJUSTMENT_IN">Quantity Correction Increase (+)</option>
                  </select>
                </div>

                {selectedProduct?.inventoryType === 'SERIALIZED' ? (
                  <div className="space-y-1.5">
                    <Label required>Serial Number (In Stock)</Label>
                    <SearchableSelect
                      options={selectedProduct.serializedItems.map((s) => ({
                        value: s.id,
                        label: s.serialNumber,
                      }))}
                      value={serializedItemId}
                      onChange={setSerializedItemId}
                      placeholder="Select serial number..."
                    />
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Label htmlFor="adj-qty" required>
                      Quantity
                    </Label>
                    <Input
                      id="adj-qty"
                      type="number"
                      min={1}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      className="tabular-nums"
                    />
                  </div>
                )}

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="adj-reason" required>
                    Adjustment Reason
                  </Label>
                  <Textarea
                    id="adj-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Describe why this adjustment is being recorded..."
                  />
                </div>
              </CardContent>
            </Card>
          </form>
        </FormPageShell>

        <div className="mx-auto max-w-5xl space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Adjustment History</h2>
          <DataTable
            columns={columns}
            data={history}
            rowKey={(r) => r.id}
            loading={loadingHistory}
            total={total}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            search={search}
            searchPlaceholder="Search adjustment history..."
            onSearchChange={(v) => {
              setSearch(v);
              setPage(1);
            }}
            onPageChange={setPage}
            onPageSizeChange={(sz) => {
              setPageSize(sz);
              setPage(1);
            }}
          />
        </div>
      </div>
    </AppShell>
  );
}
