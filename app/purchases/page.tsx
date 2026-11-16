'use client';

import * as React from 'react';
import Link from 'next/link';
import { Edit, Eye, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatDate, formatPKR } from '@/lib/format';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface PurchaseRow {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  supplier: { id: string; name: string };
  _count: { items: number };
}

export default function PurchasesPage() {
  const [items, setItems] = React.useState<PurchaseRow[]>([]);
  const [suppliers, setSuppliers] = React.useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [supplierId, setSupplierId] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [deleteTarget, setDeleteTarget] = React.useState<PurchaseRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const debouncedSearch = useDebouncedValue(search, 150);

  const loadPurchases = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search: debouncedSearch,
        });
        if (supplierId) params.set('supplierId', supplierId);
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);

        const res = await fetch(`/api/purchases?${params.toString()}`, { signal });
        if (res.ok) {
          const d = await res.json();
          setItems(d.items || []);
          setTotal(d.total || 0);
          setTotalPages(d.totalPages || 1);
        }
      } catch {
        // Ignore abort
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, pageSize, debouncedSearch, supplierId, dateFrom, dateTo]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadPurchases(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadPurchases]);

  React.useEffect(() => {
    fetch('/api/suppliers?all=1')
      .then((r) => r.json())
      .then((d) => setSuppliers(d.items || []))
      .catch(() => {});
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/purchases/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Cannot delete purchase');
      } else {
        toast.success(`Purchase ${deleteTarget.purchaseNumber} reversed and cancelled`);
        setDeleteTarget(null);
        loadPurchases();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport(format: 'excel' | 'pdf') {
    const cols = [
      { header: 'Purchase #', key: 'purchaseNumber' as const, width: 18 },
      { header: 'Date', key: (r: PurchaseRow) => formatDate(r.purchaseDate), width: 15 },
      { header: 'Supplier', key: (r: PurchaseRow) => r.supplier.name, width: 26 },
      { header: 'Total', key: (r: PurchaseRow) => formatPKR(r.totalAmount), width: 16 },
      { header: 'Paid', key: (r: PurchaseRow) => formatPKR(r.paidAmount), width: 16 },
      { header: 'Outstanding', key: (r: PurchaseRow) => formatPKR(r.outstandingAmount), width: 16 },
    ];
    if (format === 'excel') {
      await exportToExcel({
        filename: 'tayyab-purchases',
        sheetName: 'Purchases',
        title: 'Purchase History',
        columns: cols,
        rows: items,
      });
    } else {
      exportToPDF({
        filename: 'tayyab-purchases',
        title: 'Purchase History',
        columns: cols,
        rows: items,
      });
    }
  }

  const columns: DataTableColumn<PurchaseRow>[] = [
    {
      key: 'purchaseNumber',
      header: 'Purchase #',
      render: (row) => (
        <Link href={`/purchases/${row.id}`} className="font-mono font-semibold text-blue-600 hover:underline">
          {row.purchaseNumber}
        </Link>
      ),
    },
    {
      key: 'purchaseDate',
      header: 'Date',
      render: (row) => <span className="text-xs text-slate-600">{formatDate(row.purchaseDate)}</span>,
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (row) => (
        <Link href={`/suppliers/${row.supplier.id}`} className="font-medium text-slate-900 hover:text-blue-600">
          {row.supplier.name}
        </Link>
      ),
    },
    {
      key: 'items',
      header: 'Items',
      align: 'right',
      render: (row) => <span className="font-mono">{row._count.items}</span>,
    },
    {
      key: 'totalAmount',
      header: 'Total',
      align: 'right',
      render: (row) => <span className="font-mono font-semibold">{formatPKR(row.totalAmount)}</span>,
    },
    {
      key: 'paidAmount',
      header: 'Paid',
      align: 'right',
      render: (row) => <span className="font-mono text-emerald-700">{formatPKR(row.paidAmount)}</span>,
    },
    {
      key: 'outstandingAmount',
      header: 'Due',
      align: 'right',
      render: (row) => (
        <span className={`font-mono ${row.outstandingAmount > 0 ? 'text-amber-700 font-medium' : 'text-slate-500'}`}>
          {formatPKR(row.outstandingAmount)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`View ${row.purchaseNumber}`}>
            <Link href={`/purchases/${row.id}`}>
              <Eye className="h-4 w-4 text-slate-500" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${row.purchaseNumber}`}>
            <Link href={`/purchases/${row.id}/edit`}>
              <Edit className="h-4 w-4 text-slate-500" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(row)}
            aria-label={`Delete ${row.purchaseNumber}`}
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell pageTitle="Purchases">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Stock Purchases</h1>
            <p className="text-xs text-slate-500">
              Manage supplier purchase bills, serial number intake, and supplier payables.
            </p>
          </div>
          <Button asChild>
            <Link href="/purchases/new">
              <Plus className="h-4 w-4" />
              New Purchase
            </Link>
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
          searchPlaceholder="Search purchase #, supplier, notes..."
          onSearchChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
          onExportExcel={() => handleExport('excel')}
          onExportPdf={() => handleExport('pdf')}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={supplierId}
                onChange={(e) => {
                  setSupplierId(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by supplier"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
              >
                <option value="">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
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
                ariaLabel="Date from"
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
                ariaLabel="Date to"
                allowClear
                className="w-[152px]"
              />
            </div>
          }
        />

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete & Reverse Purchase"
          description={`Reverse purchase ${deleteTarget?.purchaseNumber}? Stock added by this purchase will be removed and supplier balance will be updated. Deletion is blocked if purchased units are already sold.`}
          confirmLabel="Reverse Purchase"
          loading={deleting}
          onConfirm={handleDelete}
        />
      </div>
    </AppShell>
  );
}
