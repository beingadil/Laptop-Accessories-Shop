'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeftRight, RotateCcw, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { StatusText } from '@/components/ui/status-badge';
import { formatDate, formatPKR } from '@/lib/format';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface ReturnRow {
  id: string;
  returnNumber: string;
  originalSaleId: string;
  returnDate: string;
  type: 'RETURN' | 'EXCHANGE';
  reason: string;
  refundAmount: number;
  priceDifference: number;
  profitAdjustment: number;
  originalSale: {
    id: string;
    invoiceNumber: string;
    walkInCustomerName: string | null;
  };
  customer: {
    id: string;
    name: string;
    phone: string;
  } | null;
  items: Array<{
    id: string;
    quantity: number;
    restockStatus: string;
    product: { name: string; sku: string };
    serializedItem: { serialNumber: string } | null;
  }>;
  replacementItems: Array<{
    id: string;
    quantity: number;
    product: { name: string; sku: string };
    serializedItem: { serialNumber: string } | null;
  }>;
}

const REASON_LABELS: Record<string, string> = {
  DEFECTIVE: 'Defective',
  CHANGED_MIND: 'Changed Mind',
  WRONG_PRODUCT: 'Wrong Product',
  OTHER: 'Other',
};

export default function ReturnsPage() {
  const [items, setItems] = React.useState<ReturnRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  const debouncedSearch = useDebouncedValue(search, 150);

  const loadReturns = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search: debouncedSearch,
        });
        if (typeFilter) qs.set('type', typeFilter);
        if (dateFrom) qs.set('dateFrom', dateFrom);
        if (dateTo) qs.set('dateTo', dateTo);

        const res = await fetch(`/api/returns?${qs.toString()}`, { signal });
        if (!res.ok) throw new Error('Failed to load returns');
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          toast.error('Unable to load returns & exchanges.');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, pageSize, debouncedSearch, typeFilter, dateFrom, dateTo]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadReturns(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadReturns]);

  const exportColumns = [
    { header: 'Ref #', key: 'returnNumber' as const, width: 18 },
    { header: 'Date', key: (r: ReturnRow) => formatDate(r.returnDate), width: 14 },
    { header: 'Type', key: 'type' as const, width: 12 },
    { header: 'Original Invoice', key: (r: ReturnRow) => r.originalSale.invoiceNumber, width: 18 },
    {
      header: 'Customer',
      key: (r: ReturnRow) => r.customer?.name || r.originalSale.walkInCustomerName || 'Walk-in',
      width: 22,
    },
    { header: 'Reason', key: (r: ReturnRow) => REASON_LABELS[r.reason] || r.reason, width: 16 },
    { header: 'Refund (PKR)', key: (r: ReturnRow) => r.refundAmount, width: 16 },
    { header: 'Net Diff (PKR)', key: (r: ReturnRow) => r.priceDifference, width: 16 },
  ];

  const columns: DataTableColumn<ReturnRow>[] = [
    {
      key: 'returnNumber',
      header: 'Reference',
      render: (row) => (
        <div>
          <div className="font-mono text-xs font-semibold text-slate-900">{row.returnNumber}</div>
          <div className="text-xs text-slate-500 tabular-nums">{formatDate(row.returnDate)}</div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => (
        <StatusText
          tone={row.type === 'EXCHANGE' ? 'info' : 'warning'}
          label={row.type === 'EXCHANGE' ? 'Exchange' : 'Return'}
        />
      ),
    },
    {
      key: 'invoice',
      header: 'Original Invoice',
      render: (row) => (
        <div>
          <Link
            href={`/sales/${row.originalSaleId}`}
            className="font-mono text-xs font-medium text-blue-600 hover:underline"
          >
            {row.originalSale.invoiceNumber}
          </Link>
          <div className="text-xs text-slate-600">
            {row.customer?.name || row.originalSale.walkInCustomerName || 'Walk-in Customer'}
          </div>
        </div>
      ),
    },
    {
      key: 'items',
      header: 'Items & Stock Status',
      render: (row) => (
        <div className="space-y-0.5 text-xs">
          {row.items.map((it) => (
            <div key={it.id} className="text-slate-700">
              <span className="font-medium">{it.quantity}× {it.product.name}</span>
              {it.serializedItem && (
                <span className="ml-1 font-mono text-slate-500">({it.serializedItem.serialNumber})</span>
              )}
              <span className="ml-1.5 text-slate-500">· {it.restockStatus === 'RESTOCKED' ? 'Restocked' : 'Damaged'}</span>
            </div>
          ))}
          {row.replacementItems.length > 0 && (
            <div className="text-blue-700">
              Replaced with:{' '}
              {row.replacementItems
                .map((rep) => `${rep.quantity}× ${rep.product.name}${rep.serializedItem ? ` (${rep.serializedItem.serialNumber})` : ''}`)
                .join(', ')}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (row) => (
        <span className="text-xs text-slate-600">{REASON_LABELS[row.reason] || row.reason}</span>
      ),
    },
    {
      key: 'settlement',
      header: 'Cash Impact',
      align: 'right',
      render: (row) => {
        if (row.type === 'RETURN') {
          return (
            <span className="font-semibold text-red-700 tabular-nums">
              -{formatPKR(row.refundAmount)}
            </span>
          );
        }
        if (row.priceDifference > 0) {
          return (
            <span className="font-semibold text-emerald-700 tabular-nums">
              +{formatPKR(row.priceDifference)}
            </span>
          );
        }
        if (row.priceDifference < 0) {
          return (
            <span className="font-semibold text-red-700 tabular-nums">
              -{formatPKR(Math.abs(row.priceDifference))}
            </span>
          );
        }
        return <span className="text-slate-500 tabular-nums">PKR 0</span>;
      },
    },
    {
      key: 'actions',
      header: 'Invoice',
      align: 'right',
      render: (row) => (
        <Button variant="ghost" size="icon" asChild title="View Original Sale">
          <Link href={`/sales/${row.originalSaleId}`}>
            <Eye className="h-4 w-4 text-slate-600" />
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <AppShell pageTitle="Returns & Exchanges">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
              Returns &amp; Exchanges
            </h1>
            <p className="text-sm text-slate-500">
              Process customer returns, restock or quarantine defective units, and swap replacement laptops.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="outline" asChild>
              <Link href="/returns/new">
                <RotateCcw className="h-4 w-4" />
                Process Return
              </Link>
            </Button>
            <Button asChild>
              <Link href="/returns/exchange">
                <ArrowLeftRight className="h-4 w-4" />
                Process Exchange
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
          searchPlaceholder="Search return #, invoice #, customer..."
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
          filters={
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by return type"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <option value="">All Types</option>
                <option value="RETURN">Returns Only</option>
                <option value="EXCHANGE">Exchanges Only</option>
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
              filename: 'tayyab-enterprises-returns',
              sheetName: 'Returns',
              title: 'Returns & Exchanges History',
              columns: exportColumns,
              rows: items,
            })
          }
          onExportPdf={() =>
            exportToPDF({
              filename: 'tayyab-enterprises-returns',
              title: 'Returns & Exchanges History',
              columns: exportColumns,
              rows: items,
            })
          }
          emptyTitle="No returns or exchanges recorded"
          emptyDescription="Use Process Return or Process Exchange to record customer item returns."
          emptyAction={
            <Button size="sm" asChild>
              <Link href="/returns/new">
                <RotateCcw className="h-4 w-4" />
                Process Return
              </Link>
            </Button>
          }
        />
      </div>
    </AppShell>
  );
}
