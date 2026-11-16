'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Edit, PackagePlus } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatusText } from '@/components/ui/status-badge';
import { formatDateTime, formatPKR } from '@/lib/format';

interface ProductDetail {
  id: string;
  name: string;
  sku: string;
  brand: string;
  model: string;
  processor: string | null;
  ram: string | null;
  ssd: string | null;
  hdd: string | null;
  storage: string | null;
  screenSize: string | null;
  condition: string;
  description: string | null;
  purchasePrice: number;
  sellingPrice: number;
  minimumStock: number;
  currentStock: number;
  inventoryType: 'SERIALIZED' | 'QUANTITY';
  status: string;
  category: { name: string };
  serializedItems: Array<{
    id: string;
    serialNumber: string;
    purchasePrice: number;
    sellingPrice: number;
    condition: string;
    stockStatus: string;
    createdAt: string;
    purchase: { id: string; purchaseNumber: string } | null;
  }>;
  stockMovements: Array<{
    id: string;
    movementType: string;
    quantity: number;
    previousStock: number;
    newStock: number;
    reason: string | null;
    createdAt: string;
    serializedItem: { serialNumber: string } | null;
  }>;
}

export default function ProductDetailPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = React.useState<ProductDetail | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetch(`/api/products/${params.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setProduct(d))
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <AppShell pageTitle="Product Details">
      {loading ? (
        <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
      ) : !product ? (
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <p className="text-sm text-slate-600">Product not found.</p>
            <Button variant="outline" asChild>
              <Link href="/products">Back to Products</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="space-y-1">
              <Link
                href="/products"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Products
              </Link>
              <h1 className="text-xl font-semibold text-slate-900">{product.name}</h1>
              <p className="text-xs text-slate-500 font-mono">
                {product.sku} · {product.category.name} · {product.inventoryType}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href={`/inventory/opening-stock?productId=${product.id}`}>
                  <PackagePlus className="h-4 w-4" />
                  Add Opening Stock
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/products/${product.id}/edit`}>
                  <Edit className="h-4 w-4" />
                  Edit Product
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Available Stock</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{product.currentStock}</p>
                <p className="text-xs text-slate-500">Min Alert: {product.minimumStock}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Purchase Cost</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {formatPKR(product.purchasePrice)}
                </p>
                <p className="text-xs text-slate-500">Avg unit cost</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Selling Price</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
                  {formatPKR(product.sellingPrice)}
                </p>
                <p className="text-xs text-emerald-700 tabular-nums">
                  Est. Margin: {formatPKR(product.sellingPrice - product.purchasePrice)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-slate-500">Condition & Brand</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {product.brand} {product.model}
                </p>
                <p className="text-xs text-slate-500">{product.condition} · {product.status}</p>
              </CardContent>
            </Card>
          </div>

          {(product.processor || product.ram || product.ssd || product.hdd || product.storage || product.screenSize) && (
            <Card>
              <CardHeader>
                <CardTitle>Hardware Specifications</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 text-sm">
                {product.processor && (
                  <div>
                    <div className="text-xs text-slate-500">Processor</div>
                    <div className="font-medium text-slate-900">{product.processor}</div>
                  </div>
                )}
                {product.ram && (
                  <div>
                    <div className="text-xs text-slate-500">RAM</div>
                    <div className="font-medium text-slate-900">{product.ram}</div>
                  </div>
                )}
                {product.ssd && (
                  <div>
                    <div className="text-xs text-slate-500">SSD</div>
                    <div className="font-medium text-slate-900">{product.ssd}</div>
                  </div>
                )}
                {product.hdd && (
                  <div>
                    <div className="text-xs text-slate-500">HDD</div>
                    <div className="font-medium text-slate-900">{product.hdd}</div>
                  </div>
                )}
                {product.storage && (
                  <div>
                    <div className="text-xs text-slate-500">Storage</div>
                    <div className="font-medium text-slate-900">{product.storage}</div>
                  </div>
                )}
                {product.screenSize && (
                  <div>
                    <div className="text-xs text-slate-500">Screen</div>
                    <div className="font-medium text-slate-900">{product.screenSize}</div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {product.inventoryType === 'SERIALIZED' && (
            <Card>
              <CardHeader>
                <CardTitle>Serialized Units ({product.serializedItems.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Condition</TableHead>
                      <TableHead className="text-right">Purchase Cost</TableHead>
                      <TableHead className="text-right">Selling Price</TableHead>
                      <TableHead>Purchase Ref</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {product.serializedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-xs text-slate-500">
                          No serial numbers recorded yet. Add stock via Purchase or Opening Stock.
                        </TableCell>
                      </TableRow>
                    ) : (
                      product.serializedItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-mono font-medium text-slate-900">
                            {item.serialNumber}
                          </TableCell>
                          <TableCell>{item.condition}</TableCell>
                          <TableCell className="text-right font-mono">{formatPKR(item.purchasePrice)}</TableCell>
                          <TableCell className="text-right font-mono">{formatPKR(item.sellingPrice)}</TableCell>
                          <TableCell className="font-mono text-xs text-slate-500">
                            {item.purchase?.purchaseNumber || 'Opening Stock'}
                          </TableCell>
                          <TableCell>
                            <StatusText
                              tone={
                                item.stockStatus === 'IN_STOCK'
                                  ? 'success'
                                  : item.stockStatus === 'SOLD'
                                  ? 'info'
                                  : 'danger'
                              }
                              label={item.stockStatus}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Recent Stock Movements</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Prev Stock</TableHead>
                    <TableHead className="text-right">New Stock</TableHead>
                    <TableHead>Reason / Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {product.stockMovements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6 text-xs text-slate-500">
                        No stock movements yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    product.stockMovements.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                          {formatDateTime(m.createdAt)}
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">{m.movementType}</TableCell>
                        <TableCell className="text-right font-mono">{m.quantity}</TableCell>
                        <TableCell className="text-right font-mono text-slate-500">{m.previousStock}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{m.newStock}</TableCell>
                        <TableCell className="text-xs text-slate-600">{m.reason || '—'}</TableCell>
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
