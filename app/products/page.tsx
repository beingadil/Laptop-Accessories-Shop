'use client';

import * as React from 'react';
import Link from 'next/link';
import { Edit, Eye, FolderKanban, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatNumber, formatPKR } from '@/lib/format';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface ProductRow {
  id: string;
  name: string;
  sku: string;
  brand: string;
  model: string;
  condition: string;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  currentStock: number;
  inventoryType: 'SERIALIZED' | 'QUANTITY';
  status: string;
  category: { id: string; name: string };
}

export default function ProductsPage() {
  const [items, setItems] = React.useState<ProductRow[]>([]);
  const [categories, setCategories] = React.useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [stockFilter, setStockFilter] = React.useState('');
  const [sortBy, setSortBy] = React.useState('createdAt');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [deleteTarget, setDeleteTarget] = React.useState<ProductRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const debouncedSearch = useDebouncedValue(search, 150);

  const loadProducts = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search: debouncedSearch,
          sortBy,
          sortOrder,
        });
        if (categoryId) params.set('categoryId', categoryId);
        if (stockFilter) params.set('stockFilter', stockFilter);

        const res = await fetch(`/api/products?${params.toString()}`, { signal });
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
          setTotal(data.total || 0);
          setTotalPages(data.totalPages || 1);
        }
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          toast.error('Failed to load products');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, pageSize, debouncedSearch, sortBy, sortOrder, categoryId, stockFilter]
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
    fetch('/api/categories?all=1')
      .then((r) => r.json())
      .then((d) => setCategories(d.items || []))
      .catch(() => {});
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not delete product');
      } else {
        toast.success(`Deleted ${deleteTarget.name}`);
        setDeleteTarget(null);
        loadProducts();
      }
    } catch {
      toast.error('Failed to delete product');
    } finally {
      setDeleting(false);
    }
  }

  function handleSort(key: string) {
    if (sortBy === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortOrder('asc');
    }
  }

  async function handleExport(type: 'excel' | 'pdf') {
    const res = await fetch('/api/products?page=1&pageSize=100');
    const data = await res.json();
    const rows: ProductRow[] = data.items || items;
    const cols = [
      { header: 'SKU', key: 'sku' as const, width: 18 },
      { header: 'Product Name', key: 'name' as const, width: 32 },
      { header: 'Category', key: (r: ProductRow) => r.category.name, width: 18 },
      { header: 'Type', key: 'inventoryType' as const, width: 14 },
      { header: 'Condition', key: 'condition' as const, width: 14 },
      { header: 'Purchase Cost', key: (r: ProductRow) => formatPKR(r.purchasePrice), width: 16 },
      { header: 'Selling Price', key: (r: ProductRow) => formatPKR(r.sellingPrice), width: 16 },
      { header: 'Stock', key: 'currentStock' as const, width: 10 },
    ];
    if (type === 'excel') {
      await exportToExcel({
        filename: 'tayyab-products-catalog',
        sheetName: 'Products',
        title: 'Product Catalog',
        columns: cols,
        rows,
      });
    } else {
      exportToPDF({
        filename: 'tayyab-products-catalog',
        title: 'Product Catalog',
        columns: cols,
        rows,
      });
    }
  }

  const columns: DataTableColumn<ProductRow>[] = [
    {
      key: 'name',
      header: 'Product',
      sortable: true,
      render: (row) => (
        <div>
          <Link href={`/products/${row.id}`} className="font-medium text-slate-900 hover:text-blue-600">
            {row.name}
          </Link>
          <div className="text-xs text-slate-500">
            <span className="font-mono">{row.sku}</span> · {row.brand || '—'} · {row.condition}
          </div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => (
        <div className="text-xs">
          <div className="font-medium text-slate-700">{row.category.name}</div>
          <div className="text-slate-500">{row.inventoryType === 'SERIALIZED' ? 'Serialized' : 'Quantity'}</div>
        </div>
      ),
    },
    {
      key: 'purchasePrice',
      header: 'Cost Price',
      sortable: true,
      align: 'right',
      render: (row) => <span className="font-mono text-slate-700">{formatPKR(row.purchasePrice)}</span>,
    },
    {
      key: 'sellingPrice',
      header: 'Selling Price',
      sortable: true,
      align: 'right',
      render: (row) => <span className="font-mono font-medium text-slate-900">{formatPKR(row.sellingPrice)}</span>,
    },
    {
      key: 'currentStock',
      header: 'Stock',
      sortable: true,
      align: 'right',
      render: (row) => {
        if (row.currentStock === 0) {
          return <StatusText tone="danger" label="0 (Out)" />;
        }
        if (row.currentStock <= row.minimumStock) {
          return <StatusText tone="warning" label={`${formatNumber(row.currentStock)} (Low)`} />;
        }
        return <StatusText tone="success" label={`${formatNumber(row.currentStock)} in stock`} />;
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" asChild title="View product" aria-label={`View ${row.name}`}>
            <Link href={`/products/${row.id}`}>
              <Eye className="h-4 w-4 text-slate-500" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild title="Edit product" aria-label={`Edit ${row.name}`}>
            <Link href={`/products/${row.id}/edit`}>
              <Edit className="h-4 w-4 text-slate-500" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(row)}
            title="Delete product"
            aria-label={`Delete ${row.name}`}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell pageTitle="Products">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Products & Catalog</h1>
            <p className="text-xs text-slate-500">
              Manage laptops, Chromebooks, chargers, batteries, RAM, SSDs, and shop accessories.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/categories">
                <FolderKanban className="h-4 w-4" />
                Manage Categories
              </Link>
            </Button>
            <Button asChild>
              <Link href="/products/new">
                <Plus className="h-4 w-4" />
                Add Product
              </Link>
            </Button>
          </div>
        </div>

        <DataTable
          columns={columns}
          data={items}
          rowKey={(r) => r.id}
          loading={loading}
          total={total}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          search={search}
          searchPlaceholder="Search by name, SKU, brand, model..."
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
          onSortChange={handleSort}
          onExportExcel={() => handleExport('excel')}
          onExportPdf={() => handleExport('pdf')}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by category"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={stockFilter}
                onChange={(e) => {
                  setStockFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by stock status"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
              >
                <option value="">All Stock States</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="LOW_STOCK">Low Stock</option>
                <option value="OUT_OF_STOCK">Out of Stock</option>
              </select>
            </div>
          }
          emptyAction={
            <Button asChild size="sm">
              <Link href="/products/new">
                <Plus className="h-4 w-4" />
                Add First Product
              </Link>
            </Button>
          }
        />

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete Product"
          description={`Are you sure you want to delete "${deleteTarget?.name}"? Products with existing purchase, sale, or serialized records cannot be deleted.`}
          confirmLabel="Delete Product"
          loading={deleting}
          onConfirm={handleDelete}
        />
      </div>
    </AppShell>
  );
}
