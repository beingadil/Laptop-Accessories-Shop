'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Edit, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface CategoryRow {
  id: string;
  name: string;
  description: string | null;
  defaultInventoryType: 'SERIALIZED' | 'QUANTITY';
  status: 'ACTIVE' | 'INACTIVE';
  _count: { products: number };
}

export default function CategoriesPage() {
  const [items, setItems] = React.useState<CategoryRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState('');

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CategoryRow | null>(null);
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [defaultInventoryType, setDefaultInventoryType] = React.useState<'SERIALIZED' | 'QUANTITY'>('QUANTITY');
  const [status, setStatus] = React.useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [saving, setSaving] = React.useState(false);

  const [deleteTarget, setDeleteTarget] = React.useState<CategoryRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const debouncedSearch = useDebouncedValue(search, 150);

  const loadCategories = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search: debouncedSearch,
        });
        const res = await fetch(`/api/categories?${params.toString()}`, { signal });
        if (res.ok) {
          const data = await res.json();
          setItems(data.items || []);
          setTotal(data.total || 0);
          setTotalPages(data.totalPages || 1);
        }
      } catch {
        // Ignore abort
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, pageSize, debouncedSearch]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadCategories(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadCategories]);

  function openNew() {
    setEditing(null);
    setName('');
    setDescription('');
    setDefaultInventoryType('QUANTITY');
    setStatus('ACTIVE');
    setFormOpen(true);
  }

  function openEdit(cat: CategoryRow) {
    setEditing(cat);
    setName(cat.name);
    setDescription(cat.description || '');
    setDefaultInventoryType(cat.defaultInventoryType);
    setStatus(cat.status);
    setFormOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Category name is required');
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/categories/${editing.id}` : '/api/categories';
      const method = editing ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, defaultInventoryType, status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to save category');
      } else {
        toast.success(editing ? 'Category updated' : 'Category created');
        setFormOpen(false);
        loadCategories();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/categories/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Cannot delete category');
      } else {
        toast.success('Category deleted');
        setDeleteTarget(null);
        loadCategories();
      }
    } finally {
      setDeleting(false);
    }
  }

  const columns: DataTableColumn<CategoryRow>[] = [
    {
      key: 'name',
      header: 'Category Name',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900">{row.name}</div>
          {row.description && <div className="text-xs text-slate-500">{row.description}</div>}
        </div>
      ),
    },
    {
      key: 'defaultInventoryType',
      header: 'Tracking Method',
      render: (row) => (
        <span className="text-xs font-mono text-slate-700">
          {row.defaultInventoryType === 'SERIALIZED' ? 'Individual Serial' : 'Quantity'}
        </span>
      ),
    },
    {
      key: 'products',
      header: 'Products',
      align: 'right',
      render: (row) => <span className="font-mono">{row._count.products}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusText
          tone={row.status === 'ACTIVE' ? 'success' : 'neutral'}
          label={row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row)} aria-label={`Edit ${row.name}`}>
            <Edit className="h-4 w-4 text-slate-500" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(row)}
            aria-label={`Delete ${row.name}`}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell pageTitle="Product Categories">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Products
            </Link>
            <h1 className="text-xl font-semibold text-slate-900">Product Categories</h1>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
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
          searchPlaceholder="Search categories..."
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

        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Category' : 'New Product Category'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cat-name" required>
                  Category Name
                </Label>
                <Input
                  id="cat-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Docking Stations"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-type" required>
                  Default Inventory Type
                </Label>
                <select
                  id="cat-type"
                  value={defaultInventoryType}
                  onChange={(e) =>
                    setDefaultInventoryType(e.target.value as 'SERIALIZED' | 'QUANTITY')
                  }
                  className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="QUANTITY">Quantity Based</option>
                  <option value="SERIALIZED">Individual Serial Numbers</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-status">Status</Label>
                <select
                  id="cat-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                  className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cat-desc">Description</Label>
                <Textarea
                  id="cat-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Category'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete Category"
          description={`Delete "${deleteTarget?.name}"? Categories with assigned products cannot be deleted.`}
          loading={deleting}
          onConfirm={handleDelete}
        />
      </div>
    </AppShell>
  );
}
