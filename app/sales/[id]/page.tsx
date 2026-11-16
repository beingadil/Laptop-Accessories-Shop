'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Edit, Printer, RotateCcw } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatPKR } from '@/lib/format';

interface SaleDetailData {
  sale: {
    id: string;
    invoiceNumber: string;
    saleDate: string;
    subtotal: number;
    discount: number;
    totalAmount: number;
    totalCost: number;
    grossProfit: number;
    paymentMethod: string;
    status: string;
    notes: string | null;
    walkInCustomerName: string | null;
    walkInCustomerPhone: string | null;
    customer: { id: string; name: string; phone: string; address: string | null } | null;
    items: Array<{
      id: string;
      quantity: number;
      returnedQuantity: number;
      unitPrice: number;
      unitCost: number;
      discount: number;
      totalAmount: number;
      warrantyMonths: number;
      product: { id: string; name: string; sku: string };
      serializedItem: { serialNumber: string } | null;
    }>;
  };
}

export default function SaleDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = React.useState<SaleDetailData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/sales/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, [params.id]);

  const sale = data?.sale;

  return (
    <AppShell pageTitle="Sale Invoice Details">
      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : !sale ? (
        <Card>
          <CardContent className="py-10 text-center">Sale invoice not found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <Link
                href="/sales"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sales
              </Link>
              <h1 className="text-xl font-semibold font-mono text-slate-900">{sale.invoiceNumber}</h1>
              <p className="text-xs text-slate-500">
                Customer:{' '}
                <strong className="text-slate-800">
                  {sale.customer?.name || sale.walkInCustomerName || 'Walk-in Customer'}
                </strong>{' '}
                · {formatDate(sale.saleDate)} · Status: {sale.status}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" asChild>
                <Link href={`/returns/new?saleId=${sale.id}`}>
                  <RotateCcw className="h-4 w-4" />
                  Return / Exchange
                </Link>
              </Button>
              {sale.status === 'COMPLETED' && (
                <Button variant="outline" asChild>
                  <Link href={`/sales/${sale.id}/edit`}>
                    <Edit className="h-4 w-4" />
                    Edit Sale
                  </Link>
                </Button>
              )}
              <Button asChild>
                <Link href={`/sales/${sale.id}/invoice`}>
                  <Printer className="h-4 w-4" />
                  A4 Invoice & PDF
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Grand Total</p>
                <p className="mt-1 text-2xl font-bold font-mono">{formatPKR(sale.totalAmount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Inventory Cost (COGS)</p>
                <p className="mt-1 text-2xl font-bold font-mono text-slate-700">{formatPKR(sale.totalCost)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Invoice Discount</p>
                <p className="mt-1 text-2xl font-bold font-mono">{formatPKR(sale.discount)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Gross Profit</p>
                <p className="mt-1 text-2xl font-bold font-mono text-emerald-700">
                  {formatPKR(sale.grossProfit)}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sold Line Items</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Serial #</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Warranty</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.items.map((item) => (
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
                      <TableCell className="font-mono text-xs text-blue-700">
                        {item.serializedItem?.serialNumber || '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.quantity}
                        {item.returnedQuantity > 0 && (
                          <span className="ml-1 text-xs text-amber-700">(-{item.returnedQuantity})</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatPKR(item.unitPrice)}</TableCell>
                      <TableCell className="text-right font-mono text-slate-500">
                        {formatPKR(item.unitCost)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {item.warrantyMonths > 0 ? `${item.warrantyMonths} Mo` : 'None'}
                      </TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {formatPKR(item.totalAmount)}
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
