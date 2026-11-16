'use client';

import * as React from 'react';
import Link from 'next/link';
import { Edit, Eye, Plus, Printer, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { StatusText } from '@/components/ui/status-badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatDate, formatPKR } from '@/lib/format';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface SaleRow {
  id: string;
  invoiceNumber: string;
  saleDate: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  grossProfit: number;
  status: string;
  walkInCustomerName: string | null;
  customer: { id: string; name: string; phone: string } | null;
  _count: { items: number };
}

export default function SalesPage() {
  const [items, setItems] = React.useState<SaleRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [deleteTarget, setDeleteTarget] = React.useState<SaleRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const debouncedSearch = useDebouncedValue(search, 150);

  const loadSales = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search: debouncedSearch,
        });
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
        if (statusFilter) params.set('status', statusFilter);

        const res = await fetch(`/api/sales?${params.toString()}`, { signal });
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
    [page, pageSize, debouncedSearch, dateFrom, dateTo, statusFilter]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadSales(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadSales]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/sales/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Could not delete invoice');
      } else {
        toast.success(`Invoice ${deleteTarget.invoiceNumber} cancelled and stock restored`);
        setDeleteTarget(null);
        loadSales();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport(format: 'excel' | 'pdf') {
    const cols = [
      { header: 'Invoice #', key: 'invoiceNumber' as const, width: 18 },
      { header: 'Date', key: (r: SaleRow) => formatDate(r.saleDate), width: 14 },
      {
        header: 'Customer',
        key: (r: SaleRow) => r.customer?.name || r.walkInCustomerName || 'Walk-in',
        width: 24,
      },
      { header: 'Total', key: (r: SaleRow) => formatPKR(r.totalAmount), width: 16 },
      { header: 'Gross Profit', key: (r: SaleRow) => formatPKR(r.grossProfit), width: 16 },
      { header: 'Status', key: 'status' as const, width: 14 },
    ];
    if (format === 'excel') {
      await exportToExcel({
        filename: 'tayyab-sales-invoices',
        sheetName: 'Sales',
        title: 'Sales Invoices',
        columns: cols,
        rows: items,
      });
    } else {
      exportToPDF({
        filename: 'tayyab-sales-invoices',
        title: 'Sales Invoices',
        columns: cols,
        rows: items,
      });
    }
  }

  const columns: DataTableColumn<SaleRow>[] = [
    {
      key: 'invoiceNumber',
      header: 'Invoice #',
      render: (row) => (
        <Link href={`/sales/${row.id}`} className="font-mono font-semibold text-blue-600 hover:underline">
          {row.invoiceNumber}
        </Link>
      ),
    },
    {
      key: 'saleDate',
      header: 'Date',
      render: (row) => <span className="text-xs text-slate-600">{formatDate(row.saleDate)}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-900">
            {row.customer?.name || row.walkInCustomerName || 'Walk-in Customer'}
          </div>
          {row.customer?.phone && (
            <div className="text-xs font-mono text-slate-500">{row.customer.phone}</div>
          )}
        </div>
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
      header: 'Total (Cash)',
      align: 'right',
      render: (row) => <span className="font-mono font-semibold">{formatPKR(row.totalAmount)}</span>,
    },
    {
      key: 'grossProfit',
      header: 'Gross Profit',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-emerald-700 font-medium">{formatPKR(row.grossProfit)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <StatusText
          tone={
            row.status === 'COMPLETED'
              ? 'success'
              : row.status === 'PARTIAL_RETURN'
              ? 'warning'
              : 'danger'
          }
          label={row.status}
        />
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild title="Print A4 Invoice" aria-label={`Print ${row.invoiceNumber}`}>
            <Link href={`/sales/${row.id}/invoice`}>
              <Printer className="h-4 w-4 text-blue-600" />
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild title="View details" aria-label={`View ${row.invoiceNumber}`}>
            <Link href={`/sales/${row.id}`}>
              <Eye className="h-4 w-4 text-slate-500" />
            </Link>
          </Button>
          {row.status === 'COMPLETED' && (
            <>
              <Button variant="ghost" size="icon" asChild title="Edit invoice" aria-label={`Edit ${row.invoiceNumber}`}>
                <Link href={`/sales/${row.id}/edit`}>
                  <Edit className="h-4 w-4 text-slate-500" />
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteTarget(row)}
                title="Cancel & reverse sale"
                aria-label={`Delete ${row.invoiceNumber}`}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <AppShell pageTitle="Sales Invoices">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Sales & Invoices</h1>
            <p className="text-xs text-slate-500">
              Create cash sales invoices, reprint A4 invoices, edit bills, and track invoice profit.
            </p>
          </div>
          <Button asChild>
            <Link href="/sales/new">
              <Plus className="h-4 w-4" />
              New Sale Invoice
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
          searchPlaceholder="Search invoice #, customer name or phone..."
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
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by sale status"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
              >
                <option value="">Active Invoices</option>
                <option value="COMPLETED">Completed</option>
                <option value="PARTIAL_RETURN">Partial Return</option>
                <option value="RETURNED">Returned</option>
                <option value="CANCELLED">Cancelled</option>
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
          title="Cancel & Reverse Sale Invoice"
          description={`Cancel invoice ${deleteTarget?.invoiceNumber}? All sold items and serial numbers will be restored to stock, warranties voided, and audit history preserved.`}
          confirmLabel="Cancel & Restore Stock"
          loading={deleting}
          onConfirm={handleDelete}
        />
      </div>
    </AppShell>
  );
}
