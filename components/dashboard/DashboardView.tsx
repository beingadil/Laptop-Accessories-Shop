'use client';

import * as React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Plus,
  ShoppingBag,
  PackagePlus,
  RotateCcw,
  ArrowUpRight,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

const chartFallback = () => (
  <div className="h-full w-full animate-pulse rounded-lg bg-slate-100" aria-hidden="true" />
);

// Charts render below the KPI cards — split them out of the first-load bundle.
const SalesTrendChart = dynamic(
  () => import('./DashboardCharts').then((m) => m.SalesTrendChart),
  { ssr: false, loading: chartFallback }
);
const ProfitChart = dynamic(
  () => import('./DashboardCharts').then((m) => m.ProfitChart),
  { ssr: false, loading: chartFallback }
);
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/branding/BrandMark';
import { useBranding } from '@/components/branding/BrandingProvider';
import { formatShopPhones } from '@/lib/branding';
import { formatDate, formatNumber, formatPKR } from '@/lib/format';

export interface DashboardViewData {
  kpis: {
    totalProducts: number;
    totalLaptopStock: number;
    totalChromebookStock: number;
    totalAccessoriesStock: number;
    totalStockValue: number;
    todaySales: number;
    todayProfit: number;
    monthlySales: number;
    monthlyProfit: number;
    monthlyExpenses: number;
    lowStockCount: number;
    outOfStockCount: number;
    supplierOutstanding: number;
  };
  lowStockProducts: Array<{
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    minimumStock: number;
    category: { name: string };
  }>;
  outOfStockProducts: Array<{
    id: string;
    name: string;
    sku: string;
    currentStock: number;
    minimumStock: number;
    category: { name: string };
  }>;
  recentSales: Array<{
    id: string;
    invoiceNumber: string;
    saleDate: string;
    totalAmount: number;
    grossProfit: number;
    status: string;
    walkInCustomerName: string | null;
    customer: { id: string; name: string } | null;
  }>;
  recentPurchases: Array<{
    id: string;
    purchaseNumber: string;
    purchaseDate: string;
    totalAmount: number;
    outstandingAmount: number;
    supplier: { id: string; name: string };
  }>;
  recentExpenses: Array<{
    id: string;
    title: string;
    amount: number;
    expenseDate: string;
    category: { name: string };
  }>;
  chartSeries: Array<{
    date: string;
    label: string;
    sales: number;
    profit: number;
  }>;
}

export function DashboardView({ initialData }: { initialData?: DashboardViewData }) {
  const { branding } = useBranding();
  const [data, setData] = React.useState<DashboardViewData | null>(initialData ?? null);
  const [loading, setLoading] = React.useState(!initialData);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (initialData) return;
    fetch('/api/dashboard')
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load dashboard');
        return res.json();
      })
      .then((json) => setData(json))
      .catch((err) => setError(err.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [initialData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-slate-200 bg-white p-4 animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-xl border border-slate-200 bg-white animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center space-y-3">
          <p className="text-sm font-medium text-red-600">{error || 'Unable to load dashboard data.'}</p>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { kpis } = data;

  const financialCards = [
    { label: "Today's Sales", value: formatPKR(kpis.todaySales), sub: 'Cash invoices today' },
    { label: "Today's Net Profit", value: formatPKR(kpis.todayProfit), sub: 'After returns & today expenses' },
    { label: 'Monthly Sales', value: formatPKR(kpis.monthlySales), sub: 'Current calendar month' },
    { label: 'Monthly Net Profit', value: formatPKR(kpis.monthlyProfit), sub: `Expenses: ${formatPKR(kpis.monthlyExpenses)}` },
  ];

  const stockCards = [
    { label: 'Total Stock Value', value: formatPKR(kpis.totalStockValue), sub: `${formatNumber(kpis.totalProducts)} active products` },
    { label: 'Laptops In Stock', value: formatNumber(kpis.totalLaptopStock), sub: 'Serialized laptop units' },
    { label: 'Chromebooks In Stock', value: formatNumber(kpis.totalChromebookStock), sub: 'Serialized Chromebook units' },
    { label: 'Accessories & Parts', value: formatNumber(kpis.totalAccessoriesStock), sub: 'Chargers, RAM, SSD, batteries' },
    { label: 'Monthly Expenses', value: formatPKR(kpis.monthlyExpenses), sub: 'Shop operating costs' },
    { label: 'Supplier Outstanding', value: formatPKR(kpis.supplierOutstanding), sub: 'Payable balance' },
    { label: 'Low Stock Alerts', value: formatNumber(kpis.lowStockCount), sub: 'At or below minimum stock' },
    { label: 'Out of Stock', value: formatNumber(kpis.outOfStockCount), sub: 'Zero quantity available' },
  ];

  const phonesSummary = formatShopPhones(branding.phone1, branding.phone2);

  return (
    <div className="space-y-6">
      {/* Quick Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <BrandMark
            shopName={branding.shopName}
            logoDataUrl={branding.logoDataUrl}
            size="lg"
          />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight truncate">
              {branding.shopName} Overview
            </h1>
            <p className="text-xs text-slate-500 truncate">
              {[branding.address, phonesSummary].filter(Boolean).join(' · ') ||
                `Real-time inventory, sales, profit, and payable metrics for ${branding.shopName}.`}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" asChild>
            <Link href="/sales/new">
              <Plus className="h-3.5 w-3.5" />
              New Sale Invoice
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/purchases/new">
              <ShoppingBag className="h-3.5 w-3.5" />
              New Purchase
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/products/new">
              <PackagePlus className="h-3.5 w-3.5" />
              Add Product
            </Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/returns/new">
              <RotateCcw className="h-3.5 w-3.5" />
              Process Return
            </Link>
          </Button>
        </div>
      </div>

      {/* Primary Financial KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {financialCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-slate-500">{card.label}</p>
              <p className="mt-1.5 text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                {card.value}
              </p>
              <p className="mt-1 text-xs text-slate-500 truncate">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Inventory & Payables KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stockCards.map((card) => (
          <Card key={card.label}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-slate-500">{card.label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">{card.value}</p>
              <p className="mt-0.5 text-[11px] text-slate-500 truncate">{card.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Daily Sales Trend (Last 14 Days)</CardTitle>
            <Link
              href="/reports?type=sales"
              className="text-xs font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              Sales Report
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            <SalesTrendChart chartSeries={data.chartSeries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Daily Net Profit (Last 14 Days)</CardTitle>
            <Link
              href="/reports?type=financial"
              className="text-xs font-medium text-blue-600 hover:underline inline-flex items-center gap-0.5"
            >
              Profit Report
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="h-64 pt-4">
            <ProfitChart chartSeries={data.chartSeries} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Stock Alerts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Sales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Sales</CardTitle>
            <Link href="/sales" className="text-xs font-medium text-blue-600 hover:underline">
              View All
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentSales.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">No sales recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentSales.map((s) => (
                  <Link
                    key={s.id}
                    href={`/sales/${s.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 font-mono">{s.invoiceNumber}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {s.customer?.name || s.walkInCustomerName || 'Walk-in'} · {formatDate(s.saleDate)}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-sm font-semibold text-slate-900 tabular-nums">
                        {formatPKR(s.totalAmount)}
                      </div>
                      <div className="text-[11px] text-emerald-700 tabular-nums">
                        +{formatPKR(s.grossProfit)}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Purchases */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Purchases</CardTitle>
            <Link href="/purchases" className="text-xs font-medium text-blue-600 hover:underline">
              View All
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {data.recentPurchases.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">No purchases recorded yet.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentPurchases.map((p) => (
                  <Link
                    key={p.id}
                    href={`/purchases/${p.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 font-mono">{p.purchaseNumber}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {p.supplier.name} · {formatDate(p.purchaseDate)}
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <div className="text-sm font-semibold text-slate-900 tabular-nums">
                        {formatPKR(p.totalAmount)}
                      </div>
                      {p.outstandingAmount > 0 && (
                        <div className="text-[11px] text-amber-700 tabular-nums">
                          Due: {formatPKR(p.outstandingAmount)}
                        </div>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Stock Alerts & Recent Expenses */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Stock Alerts & Expenses</CardTitle>
            <Link href="/inventory" className="text-xs font-medium text-blue-600 hover:underline">
              Inventory
            </Link>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100">
            {data.outOfStockProducts.length === 0 &&
            data.lowStockProducts.length === 0 &&
            data.recentExpenses.length === 0 ? (
              <p className="p-5 text-xs text-slate-500">
                No low stock alerts or recent expenses recorded yet.
              </p>
            ) : (
              <>
                {data.outOfStockProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.id}`}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-medium text-slate-900 truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{p.sku}</div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 shrink-0">
                      <XCircle className="h-3.5 w-3.5" />
                      Out of Stock
                    </span>
                  </Link>
                ))}
                {data.lowStockProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/products/${p.id}`}
                    className="flex items-center justify-between px-5 py-2.5 hover:bg-slate-50"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-medium text-slate-900 truncate">{p.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {p.currentStock} left (min {p.minimumStock})
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 shrink-0">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Low Stock
                    </span>
                  </Link>
                ))}
                {data.recentExpenses.slice(0, 3).map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between px-5 py-2.5 bg-slate-50/50">
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-medium text-slate-800 truncate">{exp.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {exp.category.name} · {formatDate(exp.expenseDate)}
                      </div>
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-800 tabular-nums shrink-0">
                      {formatPKR(exp.amount)}
                    </span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
