'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Edit, Wallet } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatPKR } from '@/lib/format';

interface SupplierDetail {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
  openingBalance: number;
  outstandingBalance: number;
  status: string;
  purchases: Array<{
    id: string;
    purchaseNumber: string;
    purchaseDate: string;
    totalAmount: number;
    paidAmount: number;
    outstandingAmount: number;
  }>;
  payments: Array<{
    id: string;
    paymentDate: string;
    amount: number;
    referenceNumber: string | null;
    notes: string | null;
  }>;
  ledger: Array<{
    id: string;
    date: string;
    type: 'OPENING' | 'PURCHASE' | 'PAYMENT';
    reference: string;
    debit: number;
    credit: number;
    runningBalance: number;
    notes: string | null;
  }>;
}

export default function SupplierDetailPage() {
  const params = useParams<{ id: string }>();
  const [supplier, setSupplier] = React.useState<SupplierDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/suppliers/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSupplier(d))
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppShell pageTitle="Supplier Ledger & Profile">
      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : !supplier ? (
        <Card>
          <CardContent className="py-10 text-center">Supplier not found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <Link
                href="/suppliers"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Suppliers
              </Link>
              <h1 className="text-xl font-semibold text-slate-900">{supplier.name}</h1>
              <p className="text-xs text-slate-500 font-mono">
                {supplier.phone} {supplier.address ? `· ${supplier.address}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href={`/supplier-payments/new?supplierId=${supplier.id}`}>
                  <Wallet className="h-4 w-4" />
                  Record Payment
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/suppliers/${supplier.id}/edit`}>
                  <Edit className="h-4 w-4" />
                  Edit Supplier
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Opening Balance</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{formatPKR(supplier.openingBalance)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Total Purchases</p>
                <p className="mt-1 text-xl font-bold tabular-nums">
                  {formatPKR(supplier.purchases.reduce((s, p) => s + p.totalAmount, 0))}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Total Payments Made</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-emerald-700">
                  {formatPKR(
                    supplier.payments.reduce((s, p) => s + p.amount, 0) +
                      supplier.purchases.reduce((s, p) => s + p.paidAmount, 0)
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Outstanding Balance</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-amber-700">
                  {formatPKR(supplier.outstandingBalance)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Supplier Ledger Statement</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Entry Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Debit (+)</TableHead>
                    <TableHead className="text-right">Credit (-)</TableHead>
                    <TableHead className="text-right">Running Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {supplier.ledger.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-xs text-slate-500">
                        No ledger transactions yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    supplier.ledger.map((row) => (
                      <TableRow key={`${row.type}-${row.id}`}>
                        <TableCell className="text-xs text-slate-600">{formatDate(row.date)}</TableCell>
                        <TableCell className="font-mono text-xs">{row.type}</TableCell>
                        <TableCell className="font-mono text-xs font-medium">{row.reference}</TableCell>
                        <TableCell className="text-right font-mono">
                          {row.debit > 0 ? formatPKR(row.debit) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-emerald-700">
                          {row.credit > 0 ? formatPKR(row.credit) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatPKR(row.runningBalance)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
