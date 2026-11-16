'use client';

import * as React from 'react';
import Link from 'next/link';
import { Edit, Eye, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatPKR } from '@/lib/format';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface SupplierRow {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  openingBalance: number;
  outstandingBalance: number;
  status: 'ACTIVE' | 'INACTIVE';
  _count: { purchases: number; payments: number };
}

export default function SuppliersPage() {
  const [items, setItems] = React.useState<SupplierRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [deleteTarget, setDeleteTarget] = React.useState<SupplierRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const debouncedSearch = useDebouncedValue(search, 150);

  const loadSuppliers = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search: debouncedSearch,
        });
        const res = await fetch(`/api/suppliers?${params.toString()}`, { signal });
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
    [page, pageSize, debouncedSearch]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadSuppliers(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadSuppliers]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/suppliers/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not delete supplier');
      } else {
        toast.success(`Deleted ${deleteTarget.name}`);
        setDeleteTarget(null);
        loadSuppliers();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport(format: 'excel' | 'pdf') {
    const cols = [
      { header: 'Supplier Name', key: 'name' as const, width: 28 },
      { header: 'Phone', key: 'phone' as const, width: 18 },
      { header: 'Address', key: (r: SupplierRow) => r.address || '', width: 30 },
      { header: 'Purchases', key: (r: SupplierRow) => r._count.purchases, width: 12 },
      { header: 'Outstanding', key: (r: SupplierRow) => formatPKR(r.outstandingBalance), width: 18 },
      { header: 'Status', key: 'status' as const, width: 12 },
    ];
    if (format === 'excel') {
      await exportToExcel({
        filename: 'tayyab-suppliers',
        sheetName: 'Suppliers',
        title: 'Supplier Directory & Balances',
        columns: cols,
        rows: items,
      });
    } else {
      exportToPDF({
        filename: 'tayyab-suppliers',
        title: 'Supplier Directory & Balances',
        columns: cols,
        rows: items,
      });
    }
  }

  const columns: DataTableColumn<SupplierRow>[] = [
    {
      key: 'name',
      header: 'Supplier',
      render: (row) => (
        <div>
          <Link href={`/suppliers/${row.id}`} className="font-medium text-slate-900 hover:text-blue-600">
            {row.name}
          </Link>
          {row.address && <div className="text-xs text-slate-500">{row.address}</div>}
        </div>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (row) => <span className="font-mono text-slate-700">{row.phone}</span>,
    },
    {
      key: 'purchases',
      header: 'Purchases',
      align: 'right',
      render: (row) => <span className="font-mono">{row._count.purchases}</span>,
    },
    {
      key: 'outstandingBalance',
      header: 'Outstanding Payable',
      align: 'right',
      render: (row) => (
        <span
          className={`font-mono font-semibold ${
            row.outstandingBalance > 0 ? 'text-amber-700' : 'text-emerald-700'
          }`}
        >
          {formatPKR(row.outstandingBalance)}
        </span>
      ),
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
          <Button variant="ghost" size="icon" asChild aria-label={`View ${row.name}`}>
            <Link href={`/suppliers/${row.id}`}>
              <Eye className="h-4 w-4 text-slate-500" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${row.name}`}>
            <Link href={`/suppliers/${row.id}/edit`}>
              <Edit className="h-4 w-4 text-slate-500" />
            </Link>
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
    <AppShell pageTitle="Suppliers">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Suppliers & Vendors</h1>
            <p className="text-xs text-slate-500">
              Track wholesalers, purchase histories, supplier ledgers, and outstanding payable balances.
            </p>
          </div>
          <Button asChild>
            <Link href="/suppliers/new">
              <Plus className="h-4 w-4" />
              Add Supplier
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
          searchPlaceholder="Search suppliers by name, phone, address..."
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
        />

        <ConfirmDialog
          open={Boolean(deleteTarget)}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          title="Delete Supplier"
          description={`Are you sure you want to delete "${deleteTarget?.name}"? Suppliers with purchases or payments cannot be deleted.`}
          loading={deleting}
          onConfirm={handleDelete}
        />
      </div>
    </AppShell>
  );
}
