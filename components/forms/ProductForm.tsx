'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FormPageShell } from '@/components/forms/FormPageShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CategoryOption {
  id: string;
  name: string;
  defaultInventoryType: 'SERIALIZED' | 'QUANTITY';
}

export interface ProductFormInitialData {
  id?: string;
  name: string;
  sku: string;
  categoryId: string;
  brand: string;
  model: string;
  processor: string;
  ram: string;
  ssd: string;
  hdd: string;
  storage: string;
  screenSize: string;
  condition: 'NEW' | 'USED' | 'REFURBISHED';
  description: string;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  inventoryType: 'SERIALIZED' | 'QUANTITY';
  status: 'ACTIVE' | 'INACTIVE';
  currentStock?: number;
}

export function ProductForm({ initialData }: { initialData?: ProductFormInitialData }) {
  const router = useRouter();
  const isEditing = Boolean(initialData?.id);

  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  const [form, setForm] = React.useState<ProductFormInitialData>(
    initialData ?? {
      name: '',
      sku: '',
      categoryId: '',
      brand: '',
      model: '',
      processor: '',
      ram: '',
      ssd: '',
      hdd: '',
      storage: '',
      screenSize: '',
      condition: 'USED',
      description: '',
      purchasePrice: 0,
      sellingPrice: 0,
      minimumStock: 3,
      inventoryType: 'QUANTITY',
      status: 'ACTIVE',
    }
  );

  React.useEffect(() => {
    const controller = new AbortController();
    fetch('/api/categories?all=1', { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => {
        const list: CategoryOption[] = d.items || [];
        setCategories(list);
        if (!initialData && list.length > 0) {
          setForm((prev) =>
            prev.categoryId
              ? prev
              : {
                  ...prev,
                  categoryId: list[0].id,
                  inventoryType: list[0].defaultInventoryType,
                }
          );
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [initialData]);

  const selectedCategory = categories.find((c) => c.id === form.categoryId);
  const catName = (selectedCategory?.name || '').toLowerCase();
  const isLaptopOrChromebook =
    form.inventoryType === 'SERIALIZED' || catName.includes('laptop') || catName.includes('chromebook');

  function handleCategoryChange(catId: string) {
    const cat = categories.find((c) => c.id === catId);
    setForm((prev) => ({
      ...prev,
      categoryId: catId,
      inventoryType:
        isEditing && (initialData?.currentStock ?? 0) > 0
          ? prev.inventoryType
          : cat?.defaultInventoryType || prev.inventoryType,
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.name.trim() || !form.sku.trim() || !form.categoryId) {
      setError('Please complete the required fields marked with *.');
      return;
    }

    setSaving(true);
    try {
      const url = isEditing ? `/api/products/${initialData!.id}` : '/api/products';
      const method = isEditing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to save product.');
        setSaving(false);
        return;
      }
      toast.success(isEditing ? 'Product updated successfully' : 'Product created successfully');
      router.push('/products');
      router.refresh();
    } catch {
      setError('Network error while saving product.');
      setSaving(false);
    }
  }

  return (
    <FormPageShell
      title={isEditing ? `Edit Product: ${initialData?.name}` : 'Add New Product'}
      subtitle="Configure product details, pricing, stock alerts, and hardware specifications."
      backHref="/products"
      backLabel="Back to Products"
      submitLabel={isEditing ? 'Update Product' : 'Save Product'}
      saving={saving}
      formId="product-form"
    >
      <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>General Product Information</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="prod-name" required>
                Product Name
              </Label>
              <Input
                id="prod-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g., HP EliteBook 840 G6"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-sku" required>
                SKU / Item Code
              </Label>
              <Input
                id="prod-sku"
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
                placeholder="e.g., LAP-HP-840G6"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-cat" required>
                Category
              </Label>
              <select
                id="prod-cat"
                value={form.categoryId}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <option value="">Select category...</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-brand">
                Brand <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <Input
                id="prod-brand"
                value={form.brand}
                onChange={(e) => setForm({ ...form, brand: e.target.value })}
                placeholder="e.g., HP, Dell, Lenovo — leave blank if not applicable"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-model">
                Model <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <Input
                id="prod-model"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                placeholder="e.g., EliteBook 840 G6 — leave blank if not applicable"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-inv-type" required>
                Inventory Tracking Method
              </Label>
              <select
                id="prod-inv-type"
                value={form.inventoryType}
                disabled={isEditing && (initialData?.currentStock ?? 0) > 0}
                onChange={(e) =>
                  setForm({ ...form, inventoryType: e.target.value as 'SERIALIZED' | 'QUANTITY' })
                }
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:bg-slate-50"
              >
                <option value="SERIALIZED">Individual Serial Number (Laptops / Chromebooks)</option>
                <option value="QUANTITY">Quantity Based (Chargers / RAM / SSD / Accessories)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-condition" required>
                Condition
              </Label>
              <select
                id="prod-condition"
                value={form.condition}
                onChange={(e) =>
                  setForm({ ...form, condition: e.target.value as 'NEW' | 'USED' | 'REFURBISHED' })
                }
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <option value="NEW">New</option>
                <option value="USED">Used</option>
                <option value="REFURBISHED">Refurbished</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prod-status" required>
                Status
              </Label>
              <select
                id="prod-status"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as 'ACTIVE' | 'INACTIVE' })}
                className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {isLaptopOrChromebook && (
          <Card>
            <CardHeader>
              <CardTitle>Laptop / Chromebook Hardware Specifications</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="spec-cpu">Processor</Label>
                <Input
                  id="spec-cpu"
                  value={form.processor}
                  onChange={(e) => setForm({ ...form, processor: e.target.value })}
                  placeholder="e.g., Core i5 8th Gen"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spec-ram">RAM</Label>
                <Input
                  id="spec-ram"
                  value={form.ram}
                  onChange={(e) => setForm({ ...form, ram: e.target.value })}
                  placeholder="e.g., 16GB DDR4"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spec-ssd">SSD</Label>
                <Input
                  id="spec-ssd"
                  value={form.ssd}
                  onChange={(e) => setForm({ ...form, ssd: e.target.value })}
                  placeholder="e.g., 256GB NVMe"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spec-hdd">HDD</Label>
                <Input
                  id="spec-hdd"
                  value={form.hdd}
                  onChange={(e) => setForm({ ...form, hdd: e.target.value })}
                  placeholder="e.g., 500GB SATA (optional)"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spec-storage">Chromebook Storage</Label>
                <Input
                  id="spec-storage"
                  value={form.storage}
                  onChange={(e) => setForm({ ...form, storage: e.target.value })}
                  placeholder="e.g., 32GB eMMC"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="spec-screen">Screen Size</Label>
                <Input
                  id="spec-screen"
                  value={form.screenSize}
                  onChange={(e) => setForm({ ...form, screenSize: e.target.value })}
                  placeholder='e.g., 14" FHD IPS'
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Pricing & Stock Alert Threshold</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="prod-cost" required>
                Default Purchase Cost (PKR)
              </Label>
              <Input
                id="prod-cost"
                type="number"
                min={0}
                value={form.purchasePrice}
                onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-price" required>
                Default Selling Price (PKR)
              </Label>
              <Input
                id="prod-price"
                type="number"
                min={0}
                value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
                className="tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="prod-min" required>
                Minimum Stock Alert Level
              </Label>
              <Input
                id="prod-min"
                type="number"
                min={0}
                value={form.minimumStock}
                onChange={(e) => setForm({ ...form, minimumStock: Number(e.target.value) })}
                className="tabular-nums"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="prod-desc">Description / Notes</Label>
              <Textarea
                id="prod-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Additional details, compatibility, or specs..."
              />
            </div>
          </CardContent>
        </Card>
      </form>
    </FormPageShell>
  );
}
