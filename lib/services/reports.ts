import { prisma } from '@/lib/prisma';

function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getDashboardData() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const fourteenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13, 0, 0, 0, 0);
  const periodStart = startOfMonth < fourteenDaysAgo ? startOfMonth : fourteenDaysAgo;

  const [
    products,
    periodSales,
    periodReturns,
    periodExpenses,
    supplierOutstandingAgg,
    recentSales,
    recentPurchases,
    recentExpenses,
  ] = await Promise.all([
    prisma.product.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        sku: true,
        currentStock: true,
        minimumStock: true,
        purchasePrice: true,
        sellingPrice: true,
        inventoryType: true,
        category: { select: { name: true } },
      },
    }),
    prisma.sale.findMany({
      where: { status: { not: 'CANCELLED' }, saleDate: { gte: periodStart } },
      select: { saleDate: true, totalAmount: true, grossProfit: true },
    }),
    prisma.return.findMany({
      where: { returnDate: { gte: periodStart } },
      select: { returnDate: true, profitAdjustment: true },
    }),
    prisma.expense.findMany({
      where: { status: 'ACTIVE', expenseDate: { gte: periodStart } },
      select: { expenseDate: true, amount: true },
    }),
    prisma.supplier.aggregate({
      where: { status: 'ACTIVE' },
      _sum: { outstandingBalance: true },
    }),
    prisma.sale.findMany({
      where: { status: { not: 'CANCELLED' } },
      orderBy: { saleDate: 'desc' },
      take: 6,
      select: {
        id: true,
        invoiceNumber: true,
        saleDate: true,
        totalAmount: true,
        grossProfit: true,
        status: true,
        walkInCustomerName: true,
        customer: { select: { id: true, name: true } },
      },
    }),
    prisma.purchase.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { purchaseDate: 'desc' },
      take: 6,
      select: {
        id: true,
        purchaseNumber: true,
        purchaseDate: true,
        totalAmount: true,
        outstandingAmount: true,
        supplier: { select: { id: true, name: true } },
      },
    }),
    prisma.expense.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { expenseDate: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        amount: true,
        expenseDate: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  let totalLaptopStock = 0;
  let totalChromebookStock = 0;
  let totalAccessoriesStock = 0;
  let totalStockValue = 0;
  const lowStockProducts: typeof products = [];
  const outOfStockProducts: typeof products = [];

  for (const p of products) {
    totalStockValue += p.currentStock * p.purchasePrice;
    const catName = p.category.name.toLowerCase();
    if (catName === 'laptops') {
      totalLaptopStock += p.currentStock;
    } else if (catName === 'chromebooks') {
      totalChromebookStock += p.currentStock;
    } else {
      totalAccessoriesStock += p.currentStock;
    }

    if (p.currentStock === 0) {
      outOfStockProducts.push(p);
    } else if (p.currentStock <= p.minimumStock) {
      lowStockProducts.push(p);
    }
  }

  // Build 14-day chart series and single-pass KPI totals
  const chartMap = new Map<string, { date: string; label: string; sales: number; profit: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = toDateKey(d);
    const label = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(d);
    chartMap.set(key, { date: key, label, sales: 0, profit: 0 });
  }

  let todaySales = 0;
  let todayGrossProfit = 0;
  let monthlySales = 0;
  let monthlyGrossProfit = 0;

  for (const s of periodSales) {
    if (s.saleDate >= startOfToday) {
      todaySales += s.totalAmount;
      todayGrossProfit += s.grossProfit;
    }
    if (s.saleDate >= startOfMonth) {
      monthlySales += s.totalAmount;
      monthlyGrossProfit += s.grossProfit;
    }
    const entry = chartMap.get(toDateKey(s.saleDate));
    if (entry) {
      entry.sales += s.totalAmount;
      entry.profit += s.grossProfit;
    }
  }

  let todayReturnAdj = 0;
  let monthlyReturnAdj = 0;
  for (const r of periodReturns) {
    if (r.returnDate >= startOfToday) {
      todayReturnAdj += r.profitAdjustment;
    }
    if (r.returnDate >= startOfMonth) {
      monthlyReturnAdj += r.profitAdjustment;
    }
    const entry = chartMap.get(toDateKey(r.returnDate));
    if (entry) {
      entry.profit += r.profitAdjustment;
    }
  }

  let todayExpenses = 0;
  let monthlyExpenses = 0;
  for (const e of periodExpenses) {
    if (e.expenseDate >= startOfToday) {
      todayExpenses += e.amount;
    }
    if (e.expenseDate >= startOfMonth) {
      monthlyExpenses += e.amount;
    }
    const entry = chartMap.get(toDateKey(e.expenseDate));
    if (entry) {
      entry.profit -= e.amount;
    }
  }

  return {
    kpis: {
      totalProducts: products.length,
      totalLaptopStock,
      totalChromebookStock,
      totalAccessoriesStock,
      totalStockValue,
      todaySales,
      todayProfit: todayGrossProfit + todayReturnAdj - todayExpenses,
      monthlySales,
      monthlyProfit: monthlyGrossProfit + monthlyReturnAdj - monthlyExpenses,
      monthlyExpenses,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
      supplierOutstanding: supplierOutstandingAgg._sum.outstandingBalance ?? 0,
    },
    lowStockProducts: lowStockProducts.slice(0, 8),
    outOfStockProducts: outOfStockProducts.slice(0, 8),
    recentSales,
    recentPurchases,
    recentExpenses,
    chartSeries: Array.from(chartMap.values()),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
