'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Edit } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusText } from '@/components/ui/status-badge';
import { formatDate, formatPKR } from '@/lib/format';

interface CustomerDetail {
  id: string;
  name: string;
  phone: string;
  address: string | null;
  notes: string | null;
  createdAt: string;
  sales: Array<{
    id: string;
    invoiceNumber: string;
    saleDate: string;
    totalAmount: number;
    status: string;
    items: Array<{
      id: string;
      quantity: number;
      product: { name: string };
      serializedItem: { serialNumber: string } | null;
    }>;
  }>;
  warranties: Array<{
    id: string;
    warrantyStart: string;
    warrantyEnd: string;
    durationMonths: number;
    status: string;
    product: { name: string };
    serializedItem: { serialNumber: string } | null;
    sale: { invoiceNumber: string };
  }>;
}

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = React.useState<CustomerDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/customers/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCustomer(d))
      .finally(() => setLoading(false));
  }, [params.id]);

  const totalSpent = customer?.sales.reduce((s, inv) => s + inv.totalAmount, 0) ?? 0;

  return (
    <AppShell pageTitle="Customer Profile">
      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : !customer ? (
        <Card>
          <CardContent className="py-10 text-center">Customer not found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <Link
                href="/customers"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Customers
              </Link>
              <h1 className="text-xl font-semibold text-slate-900">{customer.name}</h1>
              <p className="text-xs text-slate-500 font-mono">
                {customer.phone} {customer.address ? `· ${customer.address}` : ''}
              </p>
            </div>
            <Button asChild>
              <Link href={`/customers/${customer.id}/edit`}>
                <Edit className="h-4 w-4" />
                Edit Customer
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Total Invoices</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{customer.sales.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Total Purchases</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{formatPKR(totalSpent)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Warranty Records</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{customer.warranties.length}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Purchase & Invoice History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Items Purchased</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-xs text-slate-500">
                        No invoices yet for this customer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    customer.sales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono font-medium">
                          <Link href={`/sales/${s.id}`} className="text-blue-600 hover:underline">
                            {s.invoiceNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">{formatDate(s.saleDate)}</TableCell>
                        <TableCell className="text-xs text-slate-700">
                          {s.items
                            .map((i) =>
                              i.serializedItem
                                ? `${i.product.name} (${i.serializedItem.serialNumber})`
                                : `${i.product.name} × ${i.quantity}`
                            )
                            .join(', ')}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          {formatPKR(s.totalAmount)}
                        </TableCell>
                        <TableCell>
                          <Link href={`/sales/${s.id}/invoice`} className="text-xs text-blue-600 hover:underline">
                            View Invoice
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Warranty History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Serial #</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Valid Until</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.warranties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-xs text-slate-500">
                        No warranties recorded.
                      </TableCell>
                    </TableRow>
                  ) : (
                    customer.warranties.map((w) => {
                      const active = w.status !== 'VOID' && new Date(w.warrantyEnd) >= new Date();
                      return (
                        <TableRow key={w.id}>
                          <TableCell className="font-medium">{w.product.name}</TableCell>
                          <TableCell className="font-mono text-xs">
                            {w.serializedItem?.serialNumber || '—'}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{w.sale.invoiceNumber}</TableCell>
                          <TableCell className="text-xs">{formatDate(w.warrantyEnd)}</TableCell>
                          <TableCell>
                            <StatusText
                              tone={w.status === 'VOID' ? 'danger' : active ? 'success' : 'neutral'}
                              label={w.status === 'VOID' ? 'Void' : active ? 'Active' : 'Expired'}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
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
