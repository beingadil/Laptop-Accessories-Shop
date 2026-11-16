'use client';

import * as React from 'react';
import {
  BookOpen,
  Printer,
  Building2,
  UserRound,
  FileText,
  Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { SearchableSelect, type SearchableOption } from '@/components/ui/searchable-select';
import { StatusText } from '@/components/ui/status-badge';
import { formatPKR, formatDate } from '@/lib/format';
import { exportToExcel, exportLedgerPdf } from '@/lib/export';
import type { GeneralLedgerEntry } from '@/lib/domain/general-ledger';

type LedgerResponse = {
  suppliers: Array<{ id: string; name: string; phone: string | null; address: string | null; openingBalance: number; outstandingBalance: number; createdAt: string }>;
  customers: Array<{ id: string; name: string; phone: string | null; address: string | null; createdAt: string }>;
  entries: GeneralLedgerEntry[];
  totals: { debit: number; credit: number };
  openingBalance: number;
  closingBalance: number;
  supplierOutstanding: number;
  periodSales: number;
  periodPurchases: number;
  selected: { kind: string; id?: string; name: string; phone?: string | null; address?: string | null; outstandingBalance?: number; openingBalance?: number } | null;
  accountKind: string;
  count: number;
};

const TYPE_TONE: Record<string, 'info' | 'success' | 'warning' | 'neutral' | 'danger'> = {
  OPENING_BALANCE: 'warning',
  PURCHASE: 'info',
  SALE: 'info',
  PAYMENT: 'success',
  SALE_RETURN: 'warning',
  ADVANCE_PAYMENT: 'success',
  CREDIT_NOTE: 'success',
  DEBIT_ADJUSTMENT: 'danger',
  REFUND: 'warning',
  WRITE_OFF: 'neutral',
};

const TYPE_LABEL: Record<string, string> = {
  OPENING_BALANCE: 'Opening Balance',
  PURCHASE: 'Purchase Invoice',
  SALE: 'Sale Invoice',
  PAYMENT: 'Supplier Payment',
  SALE_RETURN: 'Sale Return',
  ADVANCE_PAYMENT: 'Advance Deposit',
  CREDIT_NOTE: 'Credit Note',
  DEBIT_ADJUSTMENT: 'Debit Adjustment',
  REFUND: 'Refund',
  WRITE_OFF: 'Write Off',
};

const PAGE_CAP = 400;
const GROW_STEP = 200;

export default function GeneralLedgerPage() {
  const [account, setAccount] = React.useState('all');
  const [dateRange, setDateRange] = React.useState({ from: '', to: '' });
  const { from, to } = dateRange;
  const [loading, setLoading] = React.useState(true);
  const [data, setData] = React.useState<LedgerResponse | null>(null);
  const [visibleCount, setVisibleCount] = React.useState(PAGE_CAP);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ account });
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const res = await fetch(`/api/ledger?${qs.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed');
      setData((await res.json()) as LedgerResponse);
      setVisibleCount(PAGE_CAP);
    } catch {
      toast.error('Unable to load the ledger.');
    } finally {
      setLoading(false);
    }
  }, [account, from, to]);

  React.useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        void load();
      }
    });
    return () => controller.abort();
  }, [load]);

  const accountOptions: SearchableOption[] = React.useMemo(() => {
    const options: SearchableOption[] = [
      { value: 'all', label: 'All Accounts (Global)', sublabel: 'Every posting, every account' },
      { value: 'all-suppliers', label: 'All Suppliers', sublabel: 'Combined payables statement' },
      { value: 'all-customers', label: 'All Customers', sublabel: 'Combined receivables statement' },
      { value: 'walkin', label: 'Walk-in Customers', sublabel: 'One-time counter sales' },
    ];
    for (const s of data?.suppliers ?? []) {
      options.push({ value: `supplier:${s.id}`, label: s.name, sublabel: `Supplier · ${s.phone ?? 'no phone'}` });
    }
    for (const c of data?.customers ?? []) {
      options.push({ value: `customer:${c.id}`, label: c.name, sublabel: `Customer · ${c.phone ?? 'no phone'}` });
    }
    return options;
  }, [data?.suppliers, data?.customers]);

  function setRange(v: { from: string; to: string }) {
    setDateRange(v);
  }

  const visible = data ? data.entries.slice(0, visibleCount) : [];
  const remaining = data ? data.entries.length - visible.length : 0;
  const opening = data?.openingBalance ?? 0;

  const periodLabel =
    from && to ? `${formatDate(from)} — ${formatDate(to)}`
    : from ? `From ${formatDate(from)}`
    : to ? `Up to ${formatDate(to)}`
    : 'All Time';

  const scopeLabel =
    data?.selected?.name
      ?? (account === 'all-suppliers' ? 'All Suppliers'
        : account === 'all-customers' ? 'All Customers'
          : account === 'walkin' ? 'Walk-in Customers'
            : 'All Accounts');

  async function handleExport() {
    if (!data) return;
    type ExportRow = {
      sr: number;
      date: string;
      account: string;
      reference: string;
      narration: string;
      debit: number;
      credit: number;
      balance: number;
    };
    const rows: ExportRow[] = visible.map((e, i) => ({
      sr: i + 1,
      date: formatDate(e.date),
      account: e.accountName,
      reference: e.referenceNumber,
      narration: e.description,
      debit: e.debit,
      credit: e.credit,
      balance: e.runningBalance,
    }));
    const slug = account.replace(/:/g, '-');
    await exportToExcel<ExportRow>({
      filename: `general-ledger-${slug}-${from || 'all'}-${to || 'all'}`,
      sheetName: 'General Ledger',
      title: 'General Ledger',
      subtitle: data.selected?.name ?? 'All Accounts',
      columns: [
        { header: 'Sr No.', key: 'sr', width: 8 },
        { header: 'Date', key: 'date', width: 14 },
        { header: 'Account', key: 'account', width: 28 },
        { header: 'Reference', key: 'reference', width: 20 },
        { header: 'Narration', key: 'narration', width: 44 },
        { header: 'Debit (PKR)', key: 'debit', width: 16 },
        { header: 'Credit (PKR)', key: 'credit', width: 16 },
        { header: 'Balance (PKR)', key: 'balance', width: 18 },
      ],
      rows,
    });
  }

  async function handleExportPdf() {
    if (!data) return;
    const slug = account.replace(/:/g, '-');
    await exportLedgerPdf({
      filename: `general-ledger-${slug}-${from || 'all'}-${to || 'all'}`,
      scopeLabel,
      periodLabel,
      openingDateLabel: from ? formatDate(from) : undefined,
      openingBalance: data.openingBalance,
      totalsDebit: data.totals.debit,
      totalsCredit: data.totals.credit,
      closingBalance: data.closingBalance,
      // Full statement — every filtered posting, oldest to newest
      entries: data.entries.map((e) => ({
        date: formatDate(e.date),
        accountName: e.accountName,
        referenceNumber: e.referenceNumber,
        description: e.description,
        entryType: e.entryType,
        debit: e.debit,
        credit: e.credit,
        runningBalance: e.runningBalance,
      })),
    });
  }

  return (
    <AppShell pageTitle="General Ledger">
      <div className="space-y-4">

        {/* Header: title + Preview / Export actions */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              <h1 className="text-xl font-semibold text-slate-900">General Ledger</h1>
            </div>
            <p className="text-xs text-slate-500">Accounts-payable &amp; receivable — every posting, oldest to newest.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => window.print()} disabled={loading}>
              <Printer className="h-4 w-4" />
              Preview
            </Button>
            <Button variant="outline" onClick={handleExportPdf} disabled={loading || !data}>
              <FileText className="h-4 w-4" />
              Export PDF
            </Button>
            <Button onClick={handleExport} disabled={loading || !data}>
              <Download className="h-4 w-4" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Filter bar: one account dropdown (searchable) + one date-range picker */}
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-3">
            <div className="min-w-[260px] flex-1 space-y-1">
              <p className="text-[11px] font-medium text-slate-600">Account</p>
              <SearchableSelect
                ariaLabel="Ledger account"
                placeholder="All Accounts (Global)"
                searchPlaceholder="Search accounts, suppliers, customers..."
                emptyMessage="No matching accounts"
                options={accountOptions}
                value={account}
                onChange={setAccount}
              />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-slate-600">Date Range</p>
              <DateRangePicker
                value={dateRange}
                onChange={setRange}
                label="Date Range"
                ariaLabel="Ledger date range"
                placeholder="All Time"
              />
            </div>
            <span className="ml-auto self-center text-[11px] text-slate-400">{periodLabel}</span>
          </CardContent>
        </Card>

        {/* Account banner when filtered */}
        {data?.selected && (
          <Card><CardContent className="flex flex-wrap items-center gap-3 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white">
              {data.selected.kind === 'customer' ? <UserRound className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{data.selected.name}</p><p className="text-[11px] text-slate-500">{data.selected.phone ?? 'No phone'}{data.selected.address ? ` · ${data.selected.address}` : ''}</p></div>
          </CardContent></Card>
        )}

        {/* Global table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 py-3">
            <CardTitle className="text-sm">Ledger Statement — {scopeLabel}</CardTitle>
            <span className="text-[11px] text-slate-500">{data?.count ?? 0} entries · oldest → newest</span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="w-11 px-2 py-2 font-semibold text-slate-500">Sr</th>
                    <th className="px-2 py-2 font-semibold text-slate-500">Date</th>
                    <th className="px-2 py-2 font-semibold text-slate-500">Account</th>
                    <th className="px-2 py-2 font-semibold text-slate-500">Reference</th>
                    <th className="px-2 py-2 font-semibold text-slate-500">Narration</th>
                    <th className="px-2 py-2 text-right font-semibold text-slate-500">Debit (+)</th>
                    <th className="px-2 py-2 text-right font-semibold text-slate-500">Credit (−)</th>
                    <th className="px-2 py-2 text-right font-semibold text-slate-500">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} className="px-2 py-10 text-center text-slate-500">Loading ledger…</td></tr>
                  ) : !data || data.entries.length === 0 ? (
                    <tr><td colSpan={8} className="px-2 py-10 text-center text-slate-500">No entries for this selection.</td></tr>
                  ) : (
                    <>
                      {opening !== 0 && (
                        <tr className="border-b border-amber-100 bg-amber-50/70 italic font-medium text-amber-800">
                          <td className="px-2 py-1.5" />
                          <td className="px-2 py-1.5">{from ? formatDate(from) : '—'}</td>
                          <td className="px-2 py-1.5">{scopeLabel}</td>
                          <td className="px-2 py-1.5 font-mono">OPENING</td>
                          <td className="px-2 py-1.5">Balance brought forward</td>
                          <td className="px-2 py-1.5 text-right">{opening > 0 ? formatPKR(opening) : '—'}</td>
                          <td className="px-2 py-1.5 text-right">{opening < 0 ? formatPKR(-opening) : '—'}</td>
                          <td className="px-2 py-1.5 text-right">{formatPKR(opening)}</td>
                        </tr>
                      )}
                      {visible.map((e, i) => (
                        <tr key={e.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                          <td className="px-2 py-1.5 tabular-nums text-slate-500">{i + 1}</td>
                          <td className="px-2 py-1.5 whitespace-nowrap text-slate-600">{formatDate(e.date)}</td>
                          <td className="px-2 py-1.5 font-medium text-slate-800">{e.accountName}</td>
                          <td className="px-2 py-1.5 font-mono text-[10px] text-slate-600">{e.referenceNumber}</td>
                          <td className="px-2 py-1.5">
                            <div className="flex flex-wrap items-center gap-1">
                              <StatusText tone={TYPE_TONE[e.entryType] ?? 'neutral'} label={TYPE_LABEL[e.entryType] ?? e.entryType} />
                              <span className="text-[10px] text-slate-500">{e.description}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-blue-800">{e.debit > 0 ? formatPKR(e.debit) : '—'}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-emerald-700">{e.credit > 0 ? formatPKR(e.credit) : '—'}</td>
                          <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatPKR(e.runningBalance)}</td>
                        </tr>
                      ))}
                    </>
                  )}
                </tbody>
                {!loading && data && data.entries.length > 0 && (
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50 text-xs font-medium">
                      <td colSpan={5} className="px-2 py-2 text-slate-600">Total Period Activity</td>
                      <td className="px-2 py-2 text-right font-mono text-blue-800">{formatPKR(data.totals.debit)}</td>
                      <td className="px-2 py-2 text-right font-mono text-emerald-700">{formatPKR(data.totals.credit)}</td>
                      <td className="px-2 py-2 text-right font-mono">—</td>
                    </tr>
                    <tr className="border-t-2 border-slate-300 bg-amber-50/70 text-xs font-semibold">
                      <td colSpan={5} className="px-2 py-2.5 text-amber-900">Closing Balance (Net Dr − Cr)</td>
                      <td colSpan={2} className="px-2 py-2.5" />
                      <td className="px-2 py-2.5 text-right font-mono text-amber-900">{formatPKR(Math.abs(data.closingBalance))} {data.closingBalance >= 0 ? 'Dr' : 'Cr'}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {remaining > 0 && (
              <div className="flex items-center justify-center border-t border-slate-100 py-2">
                <Button variant="outline" size="sm" onClick={() => setVisibleCount((v) => v + GROW_STEP)}>
                  Show {Math.min(remaining, GROW_STEP)} more — {remaining} remaining
                </Button>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Print header (printers show this) */}
        <div className="hidden print:block text-center text-xs text-slate-500">
          Laptop Management System — General Ledger — {scopeLabel} — {periodLabel}
        </div>
      </div>
    </AppShell>
  );
}
