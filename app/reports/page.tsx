'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { BarChart3, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { useBranding } from '@/components/branding/BrandingProvider';
import { slugifyShopName } from '@/lib/branding';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { formatDate, formatDateTime, formatNumber, formatPKR } from '@/lib/format';
import { exportToExcel, exportToPDF, type ExportColumn } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

type ReportTab = 'sales' | 'purchases' | 'inventory' | 'financial' | 'customers' | 'movements';

const REPORT_TABS: Array<{ key: ReportTab; label: string }> = [
  { key: 'sales', label: 'Sales Report' },
  { key: 'purchases', label: 'Purchases Report' },
  { key: 'inventory', label: 'Inventory Valuation' },
  { key: 'financial', label: 'Profit & Financial' },
  { key: 'customers', label: 'Customer Sales' },
  { key: 'movements', label: 'Stock Movements' },
];

interface ReportResponse {
  type: ReportTab;
  summary: Record<string, number>;
  items: Array<Record<string, unknown>>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function ReportsContent() {
  const searchParams = useSearchParams();
  const { branding } = useBranding();
  const initialTab = ((searchParams.get('tab') || searchParams.get('type')) as ReportTab) || 'sales';
  const validInitialTab = REPORT_TABS.some((t) => t.key === initialTab) ? initialTab : 'sales';

  const [activeTab, setActiveTab] = React.useState<ReportTab>(validInitialTab);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [stockState, setStockState] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [loading, setLoading] = React.useState(true);
  const [exporting, setExporting] = React.useState(false);
  const [report, setReport] = React.useState<ReportResponse | null>(null);

  const debouncedSearch = useDebouncedValue(search, 150);

  const loadReport = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          type: activeTab,
          page: String(page),
          pageSize: String(pageSize),
          search: debouncedSearch,
        });
        if (dateFrom) qs.set('dateFrom', dateFrom);
        if (dateTo) qs.set('dateTo', dateTo);
        if (activeTab === 'inventory' && stockState) qs.set('stockState', stockState);

        const res = await fetch(`/api/reports?${qs.toString()}`, { signal });
        if (!res.ok) throw new Error('Failed to load report');
        const data = await res.json();
        setReport(data);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          toast.error('Unable to generate report.');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [activeTab, page, pageSize, debouncedSearch, dateFrom, dateTo, stockState]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadReport(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadReport]);

  function switchTab(tab: ReportTab) {
    setActiveTab(tab);
    setPage(1);
    setSearch('');
  }

  function getColumnsAndExportConfig(): {
    title: string;
    columns: DataTableColumn<Record<string, unknown>>[];
    exportCols: ExportColumn<Record<string, unknown>>[];
  } {
    if (activeTab === 'sales') {
      return {
        title: 'Sales Report',
        columns: [
          {
            key: 'invoiceNumber',
            header: 'Invoice #',
            render: (r) => <span className="font-mono text-xs font-semibold">{String(r.invoiceNumber)}</span>,
          },
          {
            key: 'saleDate',
            header: 'Date',
            render: (r) => <span className="tabular-nums">{formatDate(String(r.saleDate))}</span>,
          },
          {
            key: 'customer',
            header: 'Customer',
            render: (r) => {
              const cust = r.customer as { name: string } | null;
              return <span>{cust?.name || String(r.walkInCustomerName || 'Walk-in')}</span>;
            },
          },
          {
            key: 'totalCost',
            header: 'COGS',
            align: 'right',
            render: (r) => formatPKR(Number(r.totalCost || 0)),
          },
          {
            key: 'totalAmount',
            header: 'Revenue',
            align: 'right',
            render: (r) => <span className="font-semibold">{formatPKR(Number(r.totalAmount || 0))}</span>,
          },
          {
            key: 'grossProfit',
            header: 'Gross Profit',
            align: 'right',
            render: (r) => (
              <span className="font-semibold text-emerald-700">{formatPKR(Number(r.grossProfit || 0))}</span>
            ),
          },
        ],
        exportCols: [
          { header: 'Invoice #', key: (r) => String(r.invoiceNumber), width: 18 },
          { header: 'Date', key: (r) => formatDate(String(r.saleDate)), width: 14 },
          {
            header: 'Customer',
            key: (r) => ((r.customer as { name: string } | null)?.name || String(r.walkInCustomerName || 'Walk-in')),
            width: 24,
          },
          { header: 'COGS (PKR)', key: (r) => Number(r.totalCost || 0), width: 16 },
          { header: 'Revenue (PKR)', key: (r) => Number(r.totalAmount || 0), width: 16 },
          { header: 'Gross Profit (PKR)', key: (r) => Number(r.grossProfit || 0), width: 16 },
        ],
      };
    }

    if (activeTab === 'purchases') {
      return {
        title: 'Purchases Report',
        columns: [
          {
            key: 'purchaseNumber',
            header: 'Purchase #',
            render: (r) => <span className="font-mono text-xs font-semibold">{String(r.purchaseNumber)}</span>,
          },
          {
            key: 'purchaseDate',
            header: 'Date',
            render: (r) => <span className="tabular-nums">{formatDate(String(r.purchaseDate))}</span>,
          },
          {
            key: 'supplier',
            header: 'Supplier',
            render: (r) => <span>{(r.supplier as { name: string } | null)?.name || '-'}</span>,
          },
          {
            key: 'totalAmount',
            header: 'Total',
            align: 'right',
            render: (r) => formatPKR(Number(r.totalAmount || 0)),
          },
          {
            key: 'paidAmount',
            header: 'Paid',
            align: 'right',
            render: (r) => formatPKR(Number(r.paidAmount || 0)),
          },
          {
            key: 'outstandingAmount',
            header: 'Balance',
            align: 'right',
            render: (r) => (
              <span className={Number(r.outstandingAmount) > 0 ? 'font-semibold text-amber-700' : 'text-slate-600'}>
                {formatPKR(Number(r.outstandingAmount || 0))}
              </span>
            ),
          },
        ],
        exportCols: [
          { header: 'Purchase #', key: (r) => String(r.purchaseNumber), width: 18 },
          { header: 'Date', key: (r) => formatDate(String(r.purchaseDate)), width: 14 },
          { header: 'Supplier', key: (r) => (r.supplier as { name: string } | null)?.name || '-', width: 24 },
          { header: 'Total (PKR)', key: (r) => Number(r.totalAmount || 0), width: 16 },
          { header: 'Paid (PKR)', key: (r) => Number(r.paidAmount || 0), width: 16 },
          { header: 'Outstanding (PKR)', key: (r) => Number(r.outstandingAmount || 0), width: 16 },
        ],
      };
    }

    if (activeTab === 'inventory') {
      return {
        title: 'Inventory Valuation Report',
        columns: [
          {
            key: 'name',
            header: 'Product',
            render: (r) => (
              <div>
                <div className="font-medium text-slate-900">{String(r.name)}</div>
                <div className="text-xs font-mono text-slate-500">{String(r.sku)}</div>
              </div>
            ),
          },
          {
            key: 'category',
            header: 'Category',
            render: (r) => (r.category as { name: string } | null)?.name || '-',
          },
          {
            key: 'currentStock',
            header: 'In Stock',
            align: 'right',
            render: (r) => (
              <span className={Number(r.currentStock) <= Number(r.minimumStock) ? 'font-semibold text-amber-700' : ''}>
                {formatNumber(Number(r.currentStock || 0))}
              </span>
            ),
          },
          {
            key: 'purchasePrice',
            header: 'Avg Cost',
            align: 'right',
            render: (r) => formatPKR(Number(r.purchasePrice || 0)),
          },
          {
            key: 'stockValue',
            header: 'Stock Cost Value',
            align: 'right',
            render: (r) => (
              <span className="font-semibold">
                {formatPKR(Number(r.currentStock || 0) * Number(r.purchasePrice || 0))}
              </span>
            ),
          },
        ],
        exportCols: [
          { header: 'SKU', key: (r) => String(r.sku), width: 16 },
          { header: 'Product', key: (r) => String(r.name), width: 28 },
          { header: 'Category', key: (r) => (r.category as { name: string } | null)?.name || '-', width: 18 },
          { header: 'Stock', key: (r) => Number(r.currentStock || 0), width: 10 },
          { header: 'Unit Cost (PKR)', key: (r) => Number(r.purchasePrice || 0), width: 16 },
          {
            header: 'Stock Value (PKR)',
            key: (r) => Number(r.currentStock || 0) * Number(r.purchasePrice || 0),
            width: 18,
          },
        ],
      };
    }

    if (activeTab === 'financial') {
      return {
        title: 'Financial & Expense Ledger',
        columns: [
          {
            key: 'expenseDate',
            header: 'Date',
            render: (r) => <span className="tabular-nums">{formatDate(String(r.expenseDate))}</span>,
          },
          {
            key: 'title',
            header: 'Expense Item',
            render: (r) => <span className="font-medium text-slate-900">{String(r.title)}</span>,
          },
          {
            key: 'category',
            header: 'Category',
            render: (r) => (r.category as { name: string } | null)?.name || '-',
          },
          {
            key: 'amount',
            header: 'Amount',
            align: 'right',
            render: (r) => <span className="font-semibold text-red-700">{formatPKR(Number(r.amount || 0))}</span>,
          },
        ],
        exportCols: [
          { header: 'Date', key: (r) => formatDate(String(r.expenseDate)), width: 14 },
          { header: 'Expense Title', key: (r) => String(r.title), width: 28 },
          { header: 'Category', key: (r) => (r.category as { name: string } | null)?.name || '-', width: 18 },
          { header: 'Amount (PKR)', key: (r) => Number(r.amount || 0), width: 16 },
        ],
      };
    }

    if (activeTab === 'customers') {
      return {
        title: 'Customer Purchases Report',
        columns: [
          {
            key: 'name',
            header: 'Customer',
            render: (r) => <span className="font-medium text-slate-900">{String(r.name)}</span>,
          },
          {
            key: 'phone',
            header: 'Phone',
            render: (r) => <span className="font-mono text-xs">{String(r.phone)}</span>,
          },
          {
            key: 'invoiceCount',
            header: 'Invoices',
            align: 'right',
            render: (r) => formatNumber(Number(r.invoiceCount || 0)),
          },
          {
            key: 'totalSpent',
            header: 'Total Spent',
            align: 'right',
            render: (r) => <span className="font-semibold">{formatPKR(Number(r.totalSpent || 0))}</span>,
          },
          {
            key: 'lastPurchaseDate',
            header: 'Last Purchase',
            render: (r) => (r.lastPurchaseDate ? formatDate(String(r.lastPurchaseDate)) : '—'),
          },
        ],
        exportCols: [
          { header: 'Customer', key: (r) => String(r.name), width: 24 },
          { header: 'Phone', key: (r) => String(r.phone), width: 16 },
          { header: 'Invoices', key: (r) => Number(r.invoiceCount || 0), width: 12 },
          { header: 'Total Spent (PKR)', key: (r) => Number(r.totalSpent || 0), width: 18 },
          {
            header: 'Last Purchase',
            key: (r) => (r.lastPurchaseDate ? formatDate(String(r.lastPurchaseDate)) : '-'),
            width: 14,
          },
        ],
      };
    }

    return {
      title: 'Stock Movements Report',
      columns: [
        {
          key: 'createdAt',
          header: 'Timestamp',
          render: (r) => <span className="text-xs tabular-nums">{formatDateTime(String(r.createdAt))}</span>,
        },
        {
          key: 'product',
          header: 'Product',
          render: (r) => {
            const p = r.product as { name: string; sku: string } | null;
            const s = r.serializedItem as { serialNumber: string } | null;
            return (
              <div>
                <div className="font-medium text-slate-900">{p?.name || '-'}</div>
                <div className="text-xs font-mono text-slate-500">
                  {s ? `SN: ${s.serialNumber}` : p?.sku || ''}
                </div>
              </div>
            );
          },
        },
        {
          key: 'movementType',
          header: 'Movement',
          render: (r) => <span className="font-mono text-xs">{String(r.movementType)}</span>,
        },
        {
          key: 'quantity',
          header: 'Qty',
          align: 'right',
          render: (r) => formatNumber(Number(r.quantity || 0)),
        },
        {
          key: 'stock',
          header: 'Prev → New',
          align: 'right',
          render: (r) => (
            <span className="tabular-nums text-xs">
              {Number(r.previousStock)} → <strong>{Number(r.newStock)}</strong>
            </span>
          ),
        },
        {
          key: 'reason',
          header: 'Reason',
          render: (r) => <span className="text-xs text-slate-600">{String(r.reason || '-')}</span>,
        },
      ],
      exportCols: [
        { header: 'Timestamp', key: (r) => formatDateTime(String(r.createdAt)), width: 18 },
        { header: 'Product', key: (r) => (r.product as { name: string } | null)?.name || '-', width: 26 },
        {
          header: 'Serial #',
          key: (r) => (r.serializedItem as { serialNumber: string } | null)?.serialNumber || '-',
          width: 18,
        },
        { header: 'Type', key: (r) => String(r.movementType), width: 16 },
        { header: 'Qty', key: (r) => Number(r.quantity || 0), width: 8 },
        { header: 'Previous', key: (r) => Number(r.previousStock || 0), width: 10 },
        { header: 'New', key: (r) => Number(r.newStock || 0), width: 10 },
        { header: 'Reason', key: (r) => String(r.reason || '-'), width: 28 },
      ],
    };
  }

  async function handleFullExport(format: 'excel' | 'pdf') {
    setExporting(true);
    try {
      const qs = new URLSearchParams({
        type: activeTab,
        export: '1',
        search,
      });
      if (dateFrom) qs.set('dateFrom', dateFrom);
      if (dateTo) qs.set('dateTo', dateTo);
      if (activeTab === 'inventory' && stockState) qs.set('stockState', stockState);

      const res = await fetch(`/api/reports?${qs.toString()}`);
      if (!res.ok) throw new Error('Export failed');
      const fullData: ReportResponse = await res.json();
      const { title, exportCols } = getColumnsAndExportConfig();
      const subtitle =
        dateFrom || dateTo
          ? `Period: ${dateFrom || 'Start'} to ${dateTo || 'Today'}`
          : 'All-time records';

      const filePrefix = slugifyShopName(branding.shopName);

      if (format === 'excel') {
        await exportToExcel({
          filename: `${filePrefix}-${activeTab}-report`,
          sheetName: title,
          title,
          subtitle,
          columns: exportCols,
          rows: fullData.items || [],
          branding,
        });
      } else {
        await exportToPDF({
          filename: `${filePrefix}-${activeTab}-report`,
          title,
          subtitle,
          columns: exportCols,
          rows: fullData.items || [],
          branding,
        });
      }
      toast.success(`Exported ${fullData.items.length} record(s) to ${format.toUpperCase()}.`);
    } catch {
      toast.error('Failed to export report.');
    } finally {
      setExporting(false);
    }
  }

  const { columns } = getColumnsAndExportConfig();
  const summary = report?.summary || {};

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
            Business &amp; Financial Reports
          </h1>
          <p className="text-sm text-slate-500">
            Analyze real-time sales, purchases, stock valuation, profit &amp; loss, and inventory movements.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={exporting}
            onClick={() => handleFullExport('excel')}
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export Excel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={exporting}
            onClick={() => handleFullExport('pdf')}
          >
            <Download className="h-4 w-4 text-blue-600" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5">
        {REPORT_TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => switchTab(tab.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary Strip */}
      {activeTab === 'sales' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <SummaryCard label="Invoices" value={formatNumber(summary.count || 0)} />
          <SummaryCard label="Sales Revenue" value={formatPKR(summary.totalRevenue || 0)} />
          <SummaryCard label="Cost of Goods Sold" value={formatPKR(summary.totalCost || 0)} />
          <SummaryCard label="Gross Profit" value={formatPKR(summary.grossProfit || 0)} highlight="success" />
        </div>
      )}

      {activeTab === 'purchases' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <SummaryCard label="Purchase Bills" value={formatNumber(summary.count || 0)} />
          <SummaryCard label="Total Purchased" value={formatPKR(summary.totalAmount || 0)} />
          <SummaryCard label="Total Paid" value={formatPKR(summary.paidAmount || 0)} />
          <SummaryCard label="Outstanding Payable" value={formatPKR(summary.outstandingAmount || 0)} highlight="warning" />
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <SummaryCard label="Products" value={formatNumber(summary.productCount || 0)} />
          <SummaryCard label="Total Units in Stock" value={formatNumber(summary.totalStockUnits || 0)} />
          <SummaryCard label="Inventory Cost Value" value={formatPKR(summary.totalStockValue || 0)} />
          <SummaryCard label="Estimated Retail Value" value={formatPKR(summary.totalRetailValue || 0)} highlight="success" />
        </div>
      )}

      {activeTab === 'financial' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <SummaryCard label="Sales Revenue" value={formatPKR(summary.salesRevenue || 0)} />
          <SummaryCard label="COGS" value={formatPKR(summary.costOfGoodsSold || 0)} />
          <SummaryCard label="Gross Profit" value={formatPKR(summary.grossProfit || 0)} />
          <SummaryCard label="Return Adj." value={formatPKR(summary.returnAdjustments || 0)} />
          <SummaryCard label="Shop Expenses" value={formatPKR(summary.totalExpenses || 0)} highlight="warning" />
          <SummaryCard
            label="Net Profit"
            value={formatPKR(summary.netProfit || 0)}
            highlight={(summary.netProfit || 0) >= 0 ? 'success' : 'warning'}
          />
        </div>
      )}

      {activeTab === 'customers' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard label="Matching Customers" value={formatNumber(summary.totalCustomers || 0)} />
          <SummaryCard label="Customer Spend (Page)" value={formatPKR(summary.totalSpent || 0)} />
        </div>
      )}

      {activeTab === 'movements' && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard label="Total Stock Movement Events" value={formatNumber(summary.totalMovements || 0)} />
          <div className="rounded-xl border border-slate-200 bg-white p-4 flex items-center gap-3 text-xs text-slate-600">
            <BarChart3 className="h-5 w-5 text-blue-600 shrink-0" />
            <span>Every purchase, sale, return, exchange, opening stock, and adjustment is logged below.</span>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={report?.items || []}
        rowKey={(r) => String(r.id)}
        loading={loading}
        total={report?.total || 0}
        page={page}
        pageSize={pageSize}
        totalPages={report?.totalPages || 1}
        search={search}
        searchPlaceholder="Filter report rows..."
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
            {activeTab === 'inventory' ? (
              <select
                value={stockState}
                onChange={(e) => {
                  setStockState(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter stock state"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
              >
                <option value="">All Stock</option>
                <option value="LOW">Low Stock Only</option>
                <option value="OUT">Out of Stock Only</option>
              </select>
            ) : (
              <>
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
              </>
            )}
          </div>
        }
        emptyTitle="No matching report records"
        emptyDescription="Try widening your date filter or clearing the search term."
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: 'success' | 'warning';
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold tabular-nums ${
          highlight === 'success'
            ? 'text-emerald-700'
            : highlight === 'warning'
            ? 'text-amber-700'
            : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <AppShell pageTitle="Reports">
      <React.Suspense
        fallback={
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
            Loading reports...
          </div>
        }
      >
        <ReportsContent />
      </React.Suspense>
    </AppShell>
  );
}
