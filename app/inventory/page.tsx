'use client';

import * as React from 'react';
import Link from 'next/link';
import { History, PackagePlus, SlidersHorizontal } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { StatusText } from '@/components/ui/status-badge';
import { formatDateTime, formatNumber, formatPKR } from '@/lib/format';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

type InventoryTab = 'serialized' | 'quantity' | 'low' | 'out' | 'movements';

interface SerializedRow {
  id: string;
  serialNumber: string;
  purchasePrice: number;
  sellingPrice: number;
  condition: string;
  stockStatus: string;
  product: {
    id: string;
    name: string;
    sku: string;
    brand: string;
    model: string;
    processor: string | null;
    ram: string | null;
    ssd: string | null;
    category: { name: string };
  };
  purchase: { id: string; purchaseNumber: string } | null;
}

interface QuantityProductRow {
  id: string;
  name: string;
  sku: string;
  brand: string;
  model: string;
  purchasePrice: number;
  sellingPrice: number;
  currentStock: number;
  minimumStock: number;
  inventoryType: string;
  category: { name: string };
}

interface MovementRow {
  id: string;
  movementType: string;
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string | null;
  createdAt: string;
  product: { id: string; name: string; sku: string };
  serializedItem: { serialNumber: string } | null;
}

export default function InventoryPage() {
  const [tab, setTab] = React.useState<InventoryTab>('serialized');
  const [items, setItems] = React.useState<unknown[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [stockStatus, setStockStatus] = React.useState('IN_STOCK');

  const debouncedSearch = useDebouncedValue(search, 150);

  const loadData = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search: debouncedSearch,
        });

        let endpoint = '/api/inventory';
        if (tab === 'serialized') {
          params.set('tab', 'serialized');
          if (stockStatus) params.set('stockStatus', stockStatus);
        } else if (tab === 'quantity') {
          params.set('tab', 'quantity');
        } else if (tab === 'low') {
          params.set('tab', 'all');
          params.set('alert', 'LOW_STOCK');
        } else if (tab === 'out') {
          params.set('tab', 'all');
          params.set('alert', 'OUT_OF_STOCK');
        } else if (tab === 'movements') {
          endpoint = '/api/inventory/movements';
        }

        const res = await fetch(`${endpoint}?${params.toString()}`, { signal });
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
    [tab, page, pageSize, debouncedSearch, stockStatus]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadData(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadData]);

  function switchTab(next: InventoryTab) {
    setTab(next);
    setPage(1);
    setSearch('');
  }

  async function handleExport(format: 'excel' | 'pdf') {
    if (tab === 'serialized') {
      const rows = items as SerializedRow[];
      const cols = [
        { header: 'Serial Number', key: 'serialNumber' as const, width: 20 },
        { header: 'Product', key: (r: SerializedRow) => r.product.name, width: 28 },
        { header: 'SKU', key: (r: SerializedRow) => r.product.sku, width: 16 },
        { header: 'Condition', key: 'condition' as const, width: 12 },
        { header: 'Cost', key: (r: SerializedRow) => formatPKR(r.purchasePrice), width: 15 },
        { header: 'Price', key: (r: SerializedRow) => formatPKR(r.sellingPrice), width: 15 },
        { header: 'Status', key: 'stockStatus' as const, width: 14 },
      ];
      if (format === 'excel') {
        await exportToExcel({
          filename: 'tayyab-serialized-inventory',
          sheetName: 'Serialized',
          title: 'Serialized Inventory',
          columns: cols,
          rows,
        });
      } else {
        exportToPDF({
          filename: 'tayyab-serialized-inventory',
          title: 'Serialized Inventory',
          columns: cols,
          rows,
        });
      }
    } else if (tab === 'movements') {
      const rows = items as MovementRow[];
      const cols = [
        { header: 'Date', key: (r: MovementRow) => formatDateTime(r.createdAt), width: 20 },
        { header: 'Product', key: (r: MovementRow) => r.product.name, width: 26 },
        { header: 'Type', key: 'movementType' as const, width: 16 },
        { header: 'Qty', key: 'quantity' as const, width: 8 },
        { header: 'Prev', key: 'previousStock' as const, width: 8 },
        { header: 'New', key: 'newStock' as const, width: 8 },
        { header: 'Reason', key: (r: MovementRow) => r.reason || '', width: 30 },
      ];
      if (format === 'excel') {
        await exportToExcel({
          filename: 'tayyab-stock-movements',
          sheetName: 'Movements',
          title: 'Stock Movement History',
          columns: cols,
          rows,
        });
      } else {
        exportToPDF({
          filename: 'tayyab-stock-movements',
          title: 'Stock Movement History',
          columns: cols,
          rows,
        });
      }
    } else {
      const rows = items as QuantityProductRow[];
      const cols = [
        { header: 'SKU', key: 'sku' as const, width: 16 },
        { header: 'Product', key: 'name' as const, width: 28 },
        { header: 'Category', key: (r: QuantityProductRow) => r.category.name, width: 18 },
        { header: 'Stock', key: 'currentStock' as const, width: 10 },
        { header: 'Min Stock', key: 'minimumStock' as const, width: 10 },
        { header: 'Cost', key: (r: QuantityProductRow) => formatPKR(r.purchasePrice), width: 14 },
        { header: 'Stock Value', key: (r: QuantityProductRow) => formatPKR(r.currentStock * r.purchasePrice), width: 16 },
      ];
      if (format === 'excel') {
        await exportToExcel({
          filename: `tayyab-inventory-${tab}`,
          sheetName: 'Inventory',
          title: 'Inventory Valuation Report',
          columns: cols,
          rows,
        });
      } else {
        exportToPDF({
          filename: `tayyab-inventory-${tab}`,
          title: 'Inventory Valuation Report',
          columns: cols,
          rows,
        });
      }
    }
  }

  const serializedColumns: DataTableColumn<SerializedRow>[] = [
    {
      key: 'serialNumber',
      header: 'Serial Number',
      render: (row) => (
        <span className="font-mono font-semibold text-slate-900">{row.serialNumber}</span>
      ),
    },
    {
      key: 'product',
      header: 'Product & Specs',
      render: (row) => (
        <div>
          <Link href={`/products/${row.product.id}`} className="font-medium text-slate-900 hover:text-blue-600">
            {row.product.name}
          </Link>
          <div className="text-xs text-slate-500">
            {row.product.category.name}
            {row.product.processor ? ` · ${row.product.processor}` : ''}
            {row.product.ram ? ` · ${row.product.ram}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'condition',
      header: 'Condition',
      render: (row) => <span className="text-xs font-medium text-slate-700">{row.condition}</span>,
    },
    {
      key: 'purchasePrice',
      header: 'Cost Price',
      align: 'right',
      render: (row) => <span className="font-mono">{formatPKR(row.purchasePrice)}</span>,
    },
    {
      key: 'sellingPrice',
      header: 'Selling Price',
      align: 'right',
      render: (row) => <span className="font-mono font-medium">{formatPKR(row.sellingPrice)}</span>,
    },
    {
      key: 'purchase',
      header: 'Source',
      render: (row) =>
        row.purchase ? (
          <Link href={`/purchases/${row.purchase.id}`} className="font-mono text-xs text-blue-600 hover:underline">
            {row.purchase.purchaseNumber}
          </Link>
        ) : (
          <span className="text-xs text-slate-500">Opening Stock</span>
        ),
    },
    {
      key: 'stockStatus',
      header: 'Status',
      render: (row) => (
        <StatusText
          tone={
            row.stockStatus === 'IN_STOCK'
              ? 'success'
              : row.stockStatus === 'SOLD'
              ? 'info'
              : 'danger'
          }
          label={row.stockStatus}
        />
      ),
    },
  ];

  const quantityColumns: DataTableColumn<QuantityProductRow>[] = [
    {
      key: 'name',
      header: 'Product',
      render: (row) => (
        <div>
          <Link href={`/products/${row.id}`} className="font-medium text-slate-900 hover:text-blue-600">
            {row.name}
          </Link>
          <div className="text-xs text-slate-500 font-mono">{row.sku}</div>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <span className="text-xs text-slate-700">{row.category.name}</span>,
    },
    {
      key: 'purchasePrice',
      header: 'Avg Cost',
      align: 'right',
      render: (row) => <span className="font-mono">{formatPKR(row.purchasePrice)}</span>,
    },
    {
      key: 'currentStock',
      header: 'Available Qty',
      align: 'right',
      render: (row) => (
        <span className="font-mono font-semibold text-slate-900">
          {formatNumber(row.currentStock)}
        </span>
      ),
    },
    {
      key: 'minimumStock',
      header: 'Min Level',
      align: 'right',
      render: (row) => <span className="font-mono text-slate-500">{row.minimumStock}</span>,
    },
    {
      key: 'valuation',
      header: 'Stock Value',
      align: 'right',
      render: (row) => (
        <span className="font-mono font-medium text-slate-900">
          {formatPKR(row.currentStock * row.purchasePrice)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Alert Status',
      render: (row) =>
        row.currentStock === 0 ? (
          <StatusText tone="danger" label="Out of Stock" />
        ) : row.currentStock <= row.minimumStock ? (
          <StatusText tone="warning" label="Low Stock" />
        ) : (
          <StatusText tone="success" label="Healthy" />
        ),
    },
  ];

  const movementColumns: DataTableColumn<MovementRow>[] = [
    {
      key: 'createdAt',
      header: 'Date & Time',
      render: (row) => <span className="text-xs text-slate-600 whitespace-nowrap">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'product',
      header: 'Product',
      render: (row) => (
        <div>
          <Link href={`/products/${row.product.id}`} className="font-medium text-slate-900 hover:text-blue-600">
            {row.product.name}
          </Link>
          {row.serializedItem && (
            <div className="text-xs font-mono text-blue-700">SN: {row.serializedItem.serialNumber}</div>
          )}
        </div>
      ),
    },
    {
      key: 'movementType',
      header: 'Movement Type',
      render: (row) => <span className="font-mono text-xs font-medium text-slate-800">{row.movementType}</span>,
    },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      render: (row) => <span className="font-mono">{row.quantity}</span>,
    },
    {
      key: 'previousStock',
      header: 'Previous',
      align: 'right',
      render: (row) => <span className="font-mono text-slate-500">{row.previousStock}</span>,
    },
    {
      key: 'newStock',
      header: 'New Stock',
      align: 'right',
      render: (row) => <span className="font-mono font-semibold">{row.newStock}</span>,
    },
    {
      key: 'reason',
      header: 'Reason / Reference',
      render: (row) => <span className="text-xs text-slate-600">{row.reason || '—'}</span>,
    },
  ];

  const tabs: Array<{ id: InventoryTab; label: string }> = [
    { id: 'serialized', label: 'Serialized Units' },
    { id: 'quantity', label: 'Quantity Stock' },
    { id: 'low', label: 'Low Stock Alerts' },
    { id: 'out', label: 'Out of Stock' },
    { id: 'movements', label: 'Stock Movements' },
  ];

  return (
    <AppShell pageTitle="Inventory Management">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Inventory & Stock Control</h1>
            <p className="text-xs text-slate-500">
              Track individual laptop serial numbers, accessory quantities, low stock alerts, and movements.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/inventory/adjustments">
                <SlidersHorizontal className="h-4 w-4" />
                Stock Adjustment
              </Link>
            </Button>
            <Button asChild>
              <Link href="/inventory/opening-stock">
                <PackagePlus className="h-4 w-4" />
                Opening Stock
              </Link>
            </Button>
          </div>
        </div>

        {/* Segmented Control Tabs */}
        <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              {t.id === 'movements' && <History className="inline h-3.5 w-3.5 mr-1.5" />}
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'serialized' ? (
          <DataTable
            columns={serializedColumns}
            data={items as SerializedRow[]}
            rowKey={(r) => r.id}
            loading={loading}
            total={total}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            search={search}
            searchPlaceholder="Search by serial number, product, SKU..."
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
              <select
                value={stockStatus}
                onChange={(e) => {
                  setStockStatus(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by serial stock status"
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700"
              >
                <option value="">All Statuses</option>
                <option value="IN_STOCK">In Stock</option>
                <option value="SOLD">Sold</option>
                <option value="RETURNED_DEFECTIVE">Returned Defective</option>
                <option value="DAMAGED">Damaged</option>
                <option value="LOST">Lost</option>
              </select>
            }
          />
        ) : tab === 'movements' ? (
          <DataTable
            columns={movementColumns}
            data={items as MovementRow[]}
            rowKey={(r) => r.id}
            loading={loading}
            total={total}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            search={search}
            searchPlaceholder="Search by product, serial, or reason..."
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
        ) : (
          <DataTable
            columns={quantityColumns}
            data={items as QuantityProductRow[]}
            rowKey={(r) => r.id}
            loading={loading}
            total={total}
            page={page}
            pageSize={pageSize}
            totalPages={totalPages}
            search={search}
            searchPlaceholder="Search product name or SKU..."
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
        )}
      </div>
    </AppShell>
  );
}
