'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Edit } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatPKR } from '@/lib/format';

interface PurchaseDetail {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  notes: string | null;
  status: string;
  supplier: { id: string; name: string; phone: string };
  items: Array<{
    id: string;
    quantity: number;
    unitCost: number;
    totalCost: number;
    condition: string | null;
    serialNumbers: string | null;
    product: { id: string; name: string; sku: string };
  }>;
}

export default function PurchaseDetailPage() {
  const params = useParams<{ id: string }>();
  const [purchase, setPurchase] = React.useState<PurchaseDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/purchases/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPurchase(d))
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppShell pageTitle="Purchase Details">
      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : !purchase ? (
        <Card>
          <CardContent className="py-10 text-center">Purchase not found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <Link
                href="/purchases"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Purchases
              </Link>
              <h1 className="text-xl font-semibold font-mono text-slate-900">
                {purchase.purchaseNumber}
              </h1>
              <p className="text-xs text-slate-500">
                Supplier: <strong className="text-slate-800">{purchase.supplier.name}</strong> ·{' '}
                {formatDate(purchase.purchaseDate)}
              </p>
            </div>
            {purchase.status === 'COMPLETED' && (
              <Button asChild>
                <Link href={`/purchases/${purchase.id}/edit`}>
                  <Edit className="h-4 w-4" />
                  Edit Purchase
                </Link>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Total Bill Amount</p>
                <p className="mt-1 text-2xl font-bold font-mono">{formatPKR(purchase.totalAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Paid at Purchase</p>
                <p className="mt-1 text-2xl font-bold font-mono text-emerald-700">
                  {formatPKR(purchase.paidAmount)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Outstanding on Bill</p>
                <p className="mt-1 text-2xl font-bold font-mono text-amber-700">
                  {formatPKR(purchase.outstandingAmount)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Purchased Line Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Serial Numbers</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchase.items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Link
                          href={`/products/${item.product.id}`}
                          className="font-medium text-slate-900 hover:text-blue-600"
                        >
                          {item.product.name}
                        </Link>
                        <div className="text-xs font-mono text-slate-500">{item.product.sku}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-600 max-w-xs break-words">
                        {item.serialNumbers || 'Quantity item'}
                      </TableCell>
                      <TableCell className="text-right font-mono">{item.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{formatPKR(item.unitCost)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatPKR(item.totalCost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </AppShell>
  );
}
