'use client';

import * as React from 'react';
import Link from 'next/link';
import { Edit, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { formatDate, formatPKR } from '@/lib/format';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface PaymentRow {
  id: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string | null;
  notes: string | null;
  supplier: { id: string; name: string; phone: string; outstandingBalance: number };
}

export default function SupplierPaymentsPage() {
  const [items, setItems] = React.useState<PaymentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [deleteTarget, setDeleteTarget] = React.useState<PaymentRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const debouncedSearch = useDebouncedValue(search, 150);

  const loadPayments = React.useCallback(
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
        const res = await fetch(`/api/supplier-payments?${params.toString()}`, { signal });
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
    [page, pageSize, debouncedSearch, dateFrom, dateTo]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadPayments(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadPayments]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/supplier-payments/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete payment');
      } else {
        toast.success('Payment reversed and supplier balance updated');
        setDeleteTarget(null);
        loadPayments();
      }
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport(format: 'excel' | 'pdf') {
    const cols = [
      { header: 'Date', key: (r: PaymentRow) => formatDate(r.paymentDate), width: 15 },
      { header: 'Supplier', key: (r: PaymentRow) => r.supplier.name, width: 26 },
      { header: 'Amount', key: (r: PaymentRow) => formatPKR(r.amount), width: 16 },
      { header: 'Reference', key: (r: PaymentRow) => r.referenceNumber || '', width: 18 },
      { header: 'Notes', key: (r: PaymentRow) => r.notes || '', width: 28 },
    ];
    if (format === 'excel') {
      await exportToExcel({
        filename: 'tayyab-supplier-payments',
        sheetName: 'SupplierPayments',
        title: 'Supplier Payments History',
        columns: cols,
        rows: items,
      });
    } else {
      exportToPDF({
        filename: 'tayyab-supplier-payments',
        title: 'Supplier Payments History',
        columns: cols,
        rows: items,
      });
    }
  }

  const columns: DataTableColumn<PaymentRow>[] = [
    {
      key: 'paymentDate',
      header: 'Payment Date',
      render: (row) => <span className="text-xs text-slate-600">{formatDate(row.paymentDate)}</span>,
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
      key: 'referenceNumber',
      header: 'Reference',
      render: (row) => <span className="font-mono text-xs text-slate-600">{row.referenceNumber || '—'}</span>,
    },
    {
      key: 'amount',
      header: 'Paid Amount',
      align: 'right',
      render: (row) => <span className="font-mono font-semibold text-emerald-700">{formatPKR(row.amount)}</span>,
    },
    {
      key: 'outstanding',
      header: 'Current Balance',
      align: 'right',
      render: (row) => (
        <span className="font-mono text-xs text-slate-600">{formatPKR(row.supplier.outstandingBalance)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="inline-flex items-center gap-1">
          <Button variant="ghost" size="icon" asChild aria-label="Edit payment">
            <Link href={`/supplier-payments/${row.id}/edit`}>
              <Edit className="h-4 w-4 text-slate-500" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(row)}
            aria-label="Delete payment"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell pageTitle="Supplier Payments">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Supplier Payments</h1>
            <p className="text-xs text-slate-500">
              Record and manage cash payments against supplier payable balances.
            </p>
          </div>
          <Button asChild>
            <Link href="/supplier-payments/new">
              <Plus className="h-4 w-4" />
              Record Payment
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
          searchPlaceholder="Search by supplier, reference, notes..."
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
          title="Reverse Supplier Payment"
          description={`Are you sure you want to delete this ${formatPKR(deleteTarget?.amount)} payment to ${deleteTarget?.supplier.name}? Their outstanding balance will be recalculated.`}
          confirmLabel="Reverse Payment"
          loading={deleting}
          onConfirm={handleDelete}
        />
      </div>
    </AppShell>
  );
}
