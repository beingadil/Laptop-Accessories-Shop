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
import { formatDateInput } from '@/lib/format';

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  inventoryType: 'SERIALIZED' | 'QUANTITY';
  purchasePrice: number;
  sellingPrice: number;
  condition: 'NEW' | 'USED' | 'REFURBISHED';
  currentStock: number;
}

function OpeningStockFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProductId = searchParams.get('productId') || '';

  const [products, setProducts] = React.useState<ProductItem[]>([]);
  const [productId, setProductId] = React.useState(initialProductId);
  const [date, setDate] = React.useState(formatDateInput(new Date()));
  const [purchasePrice, setPurchasePrice] = React.useState(0);
  const [sellingPrice, setSellingPrice] = React.useState(0);
  const [condition, setCondition] = React.useState<'NEW' | 'USED' | 'REFURBISHED'>('USED');
  const [quantity, setQuantity] = React.useState(1);
  const [serialsText, setSerialsText] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    fetch('/api/products?all=1')
      .then((r) => r.json())
      .then((d) => {
        const list: ProductItem[] = d.items || [];
        setProducts(list);
        if (initialProductId) {
          const found = list.find((p) => p.id === initialProductId);
          if (found) {
            setPurchasePrice(found.purchasePrice);
            setSellingPrice(found.sellingPrice);
            setCondition(found.condition);
          }
        }
      });
  }, [initialProductId]);

  const selectedProduct = products.find((p) => p.id === productId);

  function handleSelectProduct(id: string) {
    setProductId(id);
    const found = products.find((p) => p.id === id);
    if (found) {
      setPurchasePrice(found.purchasePrice);
      setSellingPrice(found.sellingPrice);
      setCondition(found.condition);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!selectedProduct) {
      setError('Please select a product.');
      return;
    }

    const serialNumbers =
      selectedProduct.inventoryType === 'SERIALIZED'
        ? serialsText
            .split(/[\n,]+/)
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;

    if (selectedProduct.inventoryType === 'SERIALIZED' && (!serialNumbers || serialNumbers.length === 0)) {
      setError('Enter at least one serial number (one per line or comma-separated).');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/inventory/opening-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          date,
          purchasePrice,
          sellingPrice,
          condition,
          quantity: selectedProduct.inventoryType === 'QUANTITY' ? quantity : serialNumbers?.length,
          serialNumbers,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to record opening stock.');
        setSaving(false);
        return;
      }
      toast.success('Opening stock recorded and stock movements updated');
      router.push('/inventory');
      router.refresh();
    } catch {
      setError('Network error while recording opening stock.');
      setSaving(false);
    }
  }

  return (
    <FormPageShell
      title="Record Opening Stock"
      subtitle="Add initial existing stock for laptops, Chromebooks, or accessories without creating a supplier purchase."
      backHref="/inventory"
      backLabel="Back to Inventory"
      submitLabel="Save Opening Stock"
      saving={saving}
      formId="opening-stock-form"
    >
      <form id="opening-stock-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Opening Stock Details</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label required>Select Product</Label>
              <SearchableSelect
                options={products.map((p) => ({
                  value: p.id,
                  label: p.name,
                  sublabel: `${p.sku} · ${p.inventoryType} · Current Stock: ${p.currentStock}`,
                }))}
                value={productId}
                onChange={handleSelectProduct}
                placeholder="Search product by name or SKU..."
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="os-date" required>
                Opening Stock Date
              </Label>
              <DatePicker
                id="os-date"
                value={date}
                onChange={setDate}
                ariaLabel="Opening Stock Date"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="os-condition" required>
                Condition
              </Label>
              <select
                id="os-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value as 'NEW' | 'USED' | 'REFURBISHED')}
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
              >
                <option value="NEW">New</option>
                <option value="USED">Used</option>
                <option value="REFURBISHED">Refurbished</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="os-cost" required>
                Unit Purchase Cost (PKR)
              </Label>
              <Input
                id="os-cost"
                type="number"
                min={0}
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(Number(e.target.value))}
                className="tabular-nums"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="os-price" required>
                Unit Selling Price (PKR)
              </Label>
              <Input
                id="os-price"
                type="number"
                min={0}
                value={sellingPrice}
                onChange={(e) => setSellingPrice(Number(e.target.value))}
                className="tabular-nums"
              />
            </div>

            {selectedProduct?.inventoryType === 'SERIALIZED' ? (
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="os-serials" required>
                  Serial Numbers (one per line or comma-separated)
                </Label>
                <Textarea
                  id="os-serials"
                  rows={5}
                  value={serialsText}
                  onChange={(e) => setSerialsText(e.target.value)}
                  placeholder={'5CG81201B1\n5CG81201B2'}
                  className="font-mono"
                />
                <p className="text-xs text-slate-500">
                  Detected serial numbers:{' '}
                  <strong className="font-mono">
                    {serialsText.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean).length}
                  </strong>
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="os-qty" required>
                  Opening Quantity
                </Label>
                <Input
                  id="os-qty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="tabular-nums"
                />
              </div>
            )}

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="os-notes">Notes</Label>
              <Textarea
                id="os-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional reference notes..."
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </FormPageShell>
  );
}

export default function OpeningStockPage() {
  return (
    <AppShell pageTitle="Opening Stock">
      <React.Suspense fallback={<div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />}>
        <OpeningStockFormInner />
      </React.Suspense>
    </AppShell>
  );
}
