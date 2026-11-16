'use client';

import * as React from 'react';
import Link from 'next/link';
import { Edit2, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { DataTable, type DataTableColumn } from '@/components/tables/DataTable';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusText } from '@/components/ui/status-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate } from '@/lib/format';
import { exportToExcel, exportToPDF } from '@/lib/export';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

interface WarrantyRow {
  id: string;
  saleId: string;
  warrantyStart: string;
  warrantyEnd: string;
  durationMonths: number;
  warrantyTerms: string;
  status: 'ACTIVE' | 'EXPIRED' | 'VOID';
  computedStatus: 'ACTIVE' | 'EXPIRED' | 'VOID';
  sale: {
    id: string;
    invoiceNumber: string;
    walkInCustomerName: string | null;
    walkInCustomerPhone: string | null;
  };
  customer: { id: string; name: string; phone: string } | null;
  product: { id: string; name: string; sku: string };
  serializedItem: { id: string; serialNumber: string } | null;
}

const STATUS_TABS = [
  { key: '', label: 'All Warranties' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'VOID', label: 'Voided' },
];

export default function WarrantyPage() {
  const [items, setItems] = React.useState<WarrantyRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [totalPages, setTotalPages] = React.useState(1);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  const [editTarget, setEditTarget] = React.useState<WarrantyRow | null>(null);
  const [editDuration, setEditDuration] = React.useState(1);
  const [editStatus, setEditStatus] = React.useState<'ACTIVE' | 'EXPIRED' | 'VOID'>('ACTIVE');
  const [editTerms, setEditTerms] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<WarrantyRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const debouncedSearch = useDebouncedValue(search, 150);

  const loadWarranties = React.useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({
          page: String(page),
          pageSize: String(pageSize),
          search: debouncedSearch,
        });
        if (statusFilter) qs.set('status', statusFilter);

        const res = await fetch(`/api/warranties?${qs.toString()}`, { signal });
        if (!res.ok) throw new Error('Failed to load warranties');
        const data = await res.json();
        setItems(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        if ((err as { name?: string })?.name !== 'AbortError') {
          toast.error('Unable to load warranty records.');
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [page, pageSize, debouncedSearch, statusFilter]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void loadWarranties(controller.signal);
      }
    });
    return () => controller.abort();
  }, [loadWarranties]);

  function openEdit(row: WarrantyRow) {
    setEditTarget(row);
    setEditDuration(row.durationMonths);
    setEditStatus(row.status);
    setEditTerms(row.warrantyTerms);
  }

  async function handleSaveWarranty(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/warranties/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationMonths: editDuration,
          status: editStatus,
          warrantyTerms: editTerms,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Could not update warranty.');
        return;
      }
      toast.success('Warranty record updated.');
      setEditTarget(null);
      loadWarranties();
    } catch {
      toast.error('Network error updating warranty.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteWarranty() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/warranties/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Could not delete warranty.');
        return;
      }
      toast.success('Warranty record deleted.');
      setDeleteTarget(null);
      loadWarranties();
    } catch {
      toast.error('Network error deleting warranty.');
    } finally {
      setDeleting(false);
    }
  }

  const exportColumns = [
    { header: 'Invoice #', key: (r: WarrantyRow) => r.sale.invoiceNumber, width: 16 },
    { header: 'Product', key: (r: WarrantyRow) => r.product.name, width: 26 },
    { header: 'Serial #', key: (r: WarrantyRow) => r.serializedItem?.serialNumber || '-', width: 20 },
    {
      header: 'Customer',
      key: (r: WarrantyRow) => r.customer?.name || r.sale.walkInCustomerName || 'Walk-in',
      width: 22,
    },
    { header: 'Start Date', key: (r: WarrantyRow) => formatDate(r.warrantyStart), width: 14 },
    { header: 'End Date', key: (r: WarrantyRow) => formatDate(r.warrantyEnd), width: 14 },
    { header: 'Months', key: (r: WarrantyRow) => r.durationMonths, width: 10 },
    { header: 'Status', key: (r: WarrantyRow) => r.computedStatus, width: 12 },
  ];

  const columns: DataTableColumn<WarrantyRow>[] = [
    {
      key: 'product',
      header: 'Product & Serial #',
      render: (row) => (
        <div>
          <Link href={`/products/${row.product.id}`} className="font-medium text-slate-900 hover:text-blue-600">
            {row.product.name}
          </Link>
          <div className="text-xs text-slate-500 font-mono">
            {row.serializedItem ? `SN: ${row.serializedItem.serialNumber}` : row.product.sku}
          </div>
        </div>
      ),
    },
    {
      key: 'invoice',
      header: 'Invoice #',
      render: (row) => (
        <Link
          href={`/sales/${row.saleId}`}
          className="font-mono text-xs font-medium text-blue-600 hover:underline"
        >
          {row.sale.invoiceNumber}
        </Link>
      ),
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (row) => (
        <div>
          <div className="text-slate-900">
            {row.customer?.name || row.sale.walkInCustomerName || 'Walk-in Customer'}
          </div>
          {(row.customer?.phone || row.sale.walkInCustomerPhone) && (
            <div className="text-xs font-mono text-slate-500">
              {row.customer?.phone || row.sale.walkInCustomerPhone}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'period',
      header: 'Coverage Period',
      render: (row) => (
        <div className="text-xs tabular-nums">
          <div className="text-slate-900">
            {formatDate(row.warrantyStart)} → {formatDate(row.warrantyEnd)}
          </div>
          <div className="text-slate-500">{row.durationMonths} month(s)</div>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const tone =
          row.computedStatus === 'ACTIVE'
            ? 'success'
            : row.computedStatus === 'VOID'
            ? 'danger'
            : 'neutral';
        const label =
          row.computedStatus === 'ACTIVE'
            ? 'Active'
            : row.computedStatus === 'VOID'
            ? 'Voided'
            : 'Expired';
        return <StatusText tone={tone} label={label} />;
      },
    },
    {
      key: 'actions',
      header: 'Manage',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row)}
            title="Edit Warranty Terms"
          >
            <Edit2 className="h-4 w-4 text-slate-600" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteTarget(row)}
            title="Delete Warranty Record"
          >
            <Trash2 className="h-4 w-4 text-slate-600" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AppShell pageTitle="Warranty Management">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
              Warranty Tracking
            </h1>
            <p className="text-sm text-slate-500">
              Verify serial number coverage, expiration dates, and warranty terms for sold items.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <span>Warranties auto-generated on sale invoices</span>
          </div>
        </div>

        {/* Segmented Filter */}
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === tab.key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
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
          searchPlaceholder="Search serial #, invoice #, customer phone..."
          onSearchChange={(val) => {
            setSearch(val);
            setPage(1);
          }}
          onPageChange={setPage}
          onPageSizeChange={(sz) => {
            setPageSize(sz);
            setPage(1);
          }}
          onExportExcel={() =>
            exportToExcel({
              filename: 'tayyab-enterprises-warranties',
              sheetName: 'Warranties',
              title: 'Warranty Coverage Report',
              columns: exportColumns,
              rows: items,
            })
          }
          onExportPdf={() =>
            exportToPDF({
              filename: 'tayyab-enterprises-warranties',
              title: 'Warranty Coverage Report',
              columns: exportColumns,
              rows: items,
            })
          }
          emptyTitle="No warranty records found"
          emptyDescription="Warranties are automatically created when selling items with warranty months > 0."
        />
      </div>

      <Dialog open={Boolean(editTarget)} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Warranty Record</DialogTitle>
            <DialogDescription>
              {editTarget
                ? `${editTarget.product.name} (${editTarget.sale.invoiceNumber})`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveWarranty} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="warranty-duration">Duration (Months)</Label>
                <Input
                  id="warranty-duration"
                  type="number"
                  min={0}
                  max={60}
                  value={editDuration}
                  onChange={(e) => setEditDuration(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="warranty-status">Status</Label>
                <select
                  id="warranty-status"
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as 'ACTIVE' | 'EXPIRED' | 'VOID')
                  }
                  className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="VOID">Void</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="warranty-terms">Warranty Terms</Label>
              <Textarea
                id="warranty-terms"
                rows={3}
                value={editTerms}
                onChange={(e) => setEditTerms(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditTarget(null)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Updating...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Warranty Record"
        description={`Permanently delete the warranty record for ${deleteTarget?.product?.name ?? 'this item'} (invoice ${deleteTarget?.sale?.invoiceNumber ?? ''})? The invoice itself is not affected.`}
        confirmLabel="Delete Warranty"
        loading={deleting}
        onConfirm={handleDeleteWarranty}
      />
    </AppShell>
  );
}
