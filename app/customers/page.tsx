'use client';

import * as React from 'react';
import Link from 'next/link';
import { Edit, Eye, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatDate } from '@/lib/format';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  createdAt: string;
  _count: { sales: number };
}

export default function CustomersPage() {
  const [items, setItems] = React.useState<CustomerRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [deleteTarget, setDeleteTarget] = React.useState<CustomerRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const debouncedSearch = useDebouncedValue(search, 150);

  const loadCustomers = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search: debouncedSearch,
        });
        const res = await fetch(`/api/customers?${params.toString()}`, { signal });
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
        void loadCustomers(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadCustomers]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/customers/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not delete customer');
      } else {
        toast.success(`Deleted ${deleteTarget.name}`);
        setDeleteTarget(null);
        loadCustomers();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport(format: 'excel' | 'pdf') {
    const cols = [
      { header: 'Name', key: 'name' as const, width: 26 },
      { header: 'Phone', key: 'phone' as const, width: 18 },
      { header: 'Address', key: (r: CustomerRow) => r.address || '', width: 32 },
      { header: 'Invoices', key: (r: CustomerRow) => r._count.sales, width: 12 },
      { header: 'Created', key: (r: CustomerRow) => formatDate(r.createdAt), width: 16 },
    ];
    if (format === 'excel') {
      await exportToExcel({
        filename: 'tayyab-customers',
        sheetName: 'Customers',
        title: 'Customer Directory',
        columns: cols,
        rows: items,
      });
    } else {
      exportToPDF({
        filename: 'tayyab-customers',
        title: 'Customer Directory',
        columns: cols,
        rows: items,
      });
    }
  }

  const columns: DataTableColumn<CustomerRow>[] = [
    {
      key: 'name',
      header: 'Customer Name',
      render: (row) => (
        <Link href={`/customers/${row.id}`} className="font-medium text-slate-900 hover:text-blue-600">
          {row.name}
        </Link>
      ),
    },
    {
      key: 'phone',
      header: 'Phone Number',
      render: (row) => <span className="font-mono text-slate-700">{row.phone}</span>,
    },
    {
      key: 'address',
      header: 'Address',
      render: (row) => <span className="text-xs text-slate-600">{row.address || '—'}</span>,
    },
    {
      key: 'sales',
      header: 'Invoices',
      align: 'right',
      render: (row) => <span className="font-mono">{row._count.sales}</span>,
    },
    {
      key: 'createdAt',
      header: 'Added On',
      render: (row) => <span className="text-xs text-slate-500">{formatDate(row.createdAt)}</span>,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild aria-label={`View ${row.name}`}>
            <Link href={`/customers/${row.id}`}>
              <Eye className="h-4 w-4 text-slate-500" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label={`Edit ${row.name}`}>
            <Link href={`/customers/${row.id}/edit`}>
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
    <AppShell pageTitle="Customers">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Customer Directory</h1>
            <p className="text-xs text-slate-500">
              Manage regular customers and inspect invoice and warranty histories.
            </p>
          </div>
          <Button asChild>
            <Link href="/customers/new">
              <Plus className="h-4 w-4" />
              Add Customer
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
          searchPlaceholder="Search by name, phone, or address..."
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
          title="Delete Customer"
          description={`Are you sure you want to delete "${deleteTarget?.name}"? Customers with existing invoices cannot be deleted.`}
          loading={deleting}
          onConfirm={handleDelete}
        />
      </div>
    </AppShell>
  );
}
