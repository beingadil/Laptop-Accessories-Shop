'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, Edit2, Trash2, CreditCard, Check, X, Tags } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatDate, formatPKR } from '@/lib/format';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface ExpenseCategory {
  id: string;
  name: string;
  status?: 'ACTIVE' | 'INACTIVE';
  _count?: { expenses: number };
}

interface ExpenseRow {
  id: string;
  title: string;
  categoryId: string;
  category: { id: string; name: string };
  amount: number;
  expenseDate: string;
  description: string | null;
  notes: string | null;
}

export default function ExpensesPage() {
  const [items, setItems] = React.useState<ExpenseRow[]>([]);
  const [categories, setCategories] = React.useState<ExpenseCategory[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalAmount, setTotalAmount] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [categoryId, setCategoryId] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [sortBy, setSortBy] = React.useState('expenseDate');
  const [sortOrder, setSortOrder] = React.useState<'asc' | 'desc'>('desc');
  const [loading, setLoading] = React.useState(true);

  const [deleteTarget, setDeleteTarget] = React.useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [managerOpen, setManagerOpen] = React.useState(false);
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [addingCategory, setAddingCategory] = React.useState(false);
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = React.useState('');
  const [savingCategory, setSavingCategory] = React.useState(false);
  const [categoryDeleteTarget, setCategoryDeleteTarget] = React.useState<ExpenseCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = React.useState(false);

  React.useEffect(() => {
    fetch('/api/expense-categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.items || []))
      .catch(() => {});
  }, []);

  const debouncedSearch = useDebouncedValue(search, 150);

  const loadExpenses = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search: debouncedSearch,
          sortBy,
          sortOrder,
        });
        if (categoryId) qs.set('categoryId', categoryId);
        if (dateFrom) qs.set('dateFrom', dateFrom);
        if (dateTo) qs.set('dateTo', dateTo);

        const res = await fetch(`/api/expenses?${qs.toString()}`, { signal });
        if (!res.ok) throw new Error('Failed to load expenses');
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalAmount(data.totalAmount || 0);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          toast.error('Unable to load expenses.');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, pageSize, debouncedSearch, sortBy, sortOrder, categoryId, dateFrom, dateTo]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadExpenses(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadExpenses]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Could not delete expense.');
        return;
      }
      toast.success('Expense deleted.');
      setDeleteTarget(null);
      loadExpenses();
    } catch {
      toast.error('Network error deleting expense.');
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    const name = newCategoryName.trim();
    if (name.length < 2) {
      toast.error('Category name must be at least 2 characters.');
      return;
    }
    setAddingCategory(true);
    try {
      const res = await fetch('/api/expense-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Could not create category.');
        return;
      }
      setCategories((prev) =>
        [...prev, { id: json.id, name: json.name, status: json.status as 'ACTIVE' | 'INACTIVE', _count: { expenses: 0 } }].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setNewCategoryName('');
      toast.success(`Category "${json.name}" created.`);
    } catch {
      toast.error('Network error creating category.');
    } finally {
      setAddingCategory(false);
    }
  }

  async function handleRenameCategory(id: string) {
    const name = editingCategoryName.trim();
    if (name.length < 2) {
      toast.error('Category name must be at least 2 characters.');
      return;
    }
    setSavingCategory(true);
    try {
      const res = await fetch(`/api/expense-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Could not rename category.');
        return;
      }
      setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name: json.name } : c)));
      setEditingCategoryId(null);
      toast.success('Category renamed.');
    } catch {
      toast.error('Network error renaming category.');
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleDeleteCategory() {
    if (!categoryDeleteTarget) return;
    setDeletingCategory(true);
    try {
      const res = await fetch(`/api/expense-categories/${categoryDeleteTarget.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Could not delete category.');
        return;
      }
      setCategories((prev) => prev.filter((c) => c.id !== categoryDeleteTarget.id));
      setCategoryDeleteTarget(null);
      toast.success('Category deleted.');
    } catch {
      toast.error('Network error deleting category.');
    } finally {
      setDeletingCategory(false);
    }
  }

  function handleSort(col: string) {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder('desc');
    }
  }

  const exportColumns = [
    { header: 'Date', key: (r: ExpenseRow) => formatDate(r.expenseDate), width: 14 },
    { header: 'Title', key: 'title' as const, width: 28 },
    { header: 'Category', key: (r: ExpenseRow) => r.category.name, width: 18 },
    { header: 'Description', key: (r: ExpenseRow) => r.description || '-', width: 30 },
    { header: 'Amount (PKR)', key: (r: ExpenseRow) => r.amount, width: 16 },
  ];

  const columns: DataTableColumn<ExpenseRow>[] = [
    {
      key: 'expenseDate',
      header: 'Date',
      sortable: true,
      render: (row) => <span className="tabular-nums text-slate-600">{formatDate(row.expenseDate)}</span>,
    },
    {
      key: 'title',
      header: 'Expense Title',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900">{row.title}</div>
          {row.description && (
            <div className="text-xs text-slate-500 truncate max-w-xs">{row.description}</div>
          )}
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <span className="text-slate-700">{row.category.name}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      align: 'right',
      render: (row) => (
        <span className="font-semibold text-slate-900 tabular-nums">{formatPKR(row.amount)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" asChild title="Edit Expense">
            <Link href={`/expenses/${row.id}/edit`}>
              <Edit2 className="h-4 w-4 text-slate-600" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(row)}
            title="Delete Expense"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell pageTitle="Expenses">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Shop Expenses</h1>
            <p className="text-sm text-slate-500">
              Monitor daily operating expenses deducted from gross profit to calculate net profit.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setManagerOpen(true)}>
              <Tags className="h-4 w-4" />
              <span className="hidden sm:inline">Categories</span>
            </Button>
            <Button asChild>
              <Link href="/expenses/new">
                <Plus className="h-4 w-4" />
                Add Expense
              </Link>
            </Button>
          </div>
        </div>

        {/* Summary Strip */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Filtered Total Expenses</p>
              <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
                {formatPKR(totalAmount)}
              </p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-50 border border-slate-200 text-slate-600">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Matching Records</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">{total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-500">Expense Categories</p>
            <p className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">
              {categories.length}
            </p>
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
          searchPlaceholder="Search expense title, description, category..."
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
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by expense category"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <option value="">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <DatePicker
                value={dateFrom}
                onChange={(val) => {
                  setDateFrom(val);
                  setPage(1);
                }}
                maxDate={dateTo || undefined}
                placeholder="From date"
                ariaLabel="From date"
                allowClear
                className="w-[152px]"
              />
              <DatePicker
                value={dateTo}
                onChange={(val) => {
                  setDateTo(val);
                  setPage(1);
                }}
                minDate={dateFrom || undefined}
                placeholder="To date"
                ariaLabel="To date"
                allowClear
                className="w-[152px]"
              />
            </div>
          }
          onExportExcel={() =>
            exportToExcel({
              filename: 'tayyab-enterprises-expenses',
              sheetName: 'Expenses',
              title: 'Shop Expenses Report',
              subtitle: `Total: ${formatPKR(totalAmount)}`,
              columns: exportColumns,
              rows: items,
            })
          }
          onExportPdf={() =>
            exportToPDF({
              filename: 'tayyab-enterprises-expenses',
              title: 'Shop Expenses Report',
              subtitle: `Total: ${formatPKR(totalAmount)}`,
              columns: exportColumns,
              rows: items,
            })
          }
          emptyTitle="No expenses recorded"
          emptyDescription="Add daily shop expenses to keep net profit calculations accurate."
          emptyAction={
            <Button size="sm" asChild>
              <Link href="/expenses/new">
                <Plus className="h-4 w-4" />
                Add Expense
              </Link>
            </Button>
          }
        />
      </div>

      <Dialog open={managerOpen} onOpenChange={setManagerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Expense Categories</DialogTitle>
            <DialogDescription>
              Rename or delete categories. Categories that have expenses cannot be deleted.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddCategory} className="flex gap-2">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="New category name"
              className="h-9"
              aria-label="New category name"
            />
            <Button type="submit" disabled={addingCategory} className="h-9 shrink-0">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{addingCategory ? 'Adding…' : 'Add'}</span>
            </Button>
          </form>

          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between gap-2 py-2">
                {editingCategoryId === cat.id ? (
                  <Input
                    value={editingCategoryName}
                    onChange={(e) => setEditingCategoryName(e.target.value)}
                    className="h-8"
                    autoFocus
                    aria-label="Edit category name"
                  />
                ) : (
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-slate-800">{cat.name}</span>
                    <span className="ml-2 text-[11px] tabular-nums text-slate-400">
                      {cat._count?.expenses ?? 0} expense(s)
                    </span>
                  </div>
                )}
                <div className="flex shrink-0 items-center gap-1">
                  {editingCategoryId === cat.id ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRenameCategory(cat.id)}
                        disabled={savingCategory}
                        title="Save name"
                      >
                        <Check className="h-4 w-4 text-green-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingCategoryId(null)}
                        disabled={savingCategory}
                        title="Cancel"
                      >
                        <X className="h-4 w-4 text-slate-500" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingCategoryId(cat.id);
                          setEditingCategoryName(cat.name);
                        }}
                        title="Rename category"
                      >
                        <Edit2 className="h-4 w-4 text-slate-600" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCategoryDeleteTarget(cat)}
                        title="Delete category"
                      >
                        <Trash2 className="h-4 w-4 text-slate-600" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="py-6 text-center text-sm text-slate-500">No categories yet.</p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setManagerOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(categoryDeleteTarget)}
        onOpenChange={(open) => {
          if (!open) setCategoryDeleteTarget(null);
        }}
        title="Delete Expense Category"
        description={
          categoryDeleteTarget
            ? `Delete "${categoryDeleteTarget.name}"? Categories with expenses cannot be deleted.`
            : ''
        }
        confirmLabel="Delete Category"
        loading={deletingCategory}
        onConfirm={handleDeleteCategory}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Expense Record"
        description={
          deleteTarget
            ? `Are you sure you want to delete "${deleteTarget.title}" (${formatPKR(deleteTarget.amount)})? This will update net profit reports.`
            : ''
        }
        confirmLabel="Delete Expense"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </AppShell>
  );
}
