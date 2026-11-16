import { AppShell } from '@/components/layout/AppShell';
import { DashboardView, type DashboardViewData } from '@/components/dashboard/DashboardView';
import { ensureDatabaseSeeded } from '@/lib/database/seed';
import { getDashboardData } from '@/lib/services/reports';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  await ensureDatabaseSeeded();
  const raw = await getDashboardData();

  const initialData: DashboardViewData = {
    ...raw,
    recentSales: raw.recentSales.map((s) => ({
      ...s,
      saleDate: s.saleDate.toISOString(),
    })),
    recentPurchases: raw.recentPurchases.map((p) => ({
      ...p,
      purchaseDate: p.purchaseDate.toISOString(),
    })),
    recentExpenses: raw.recentExpenses.map((e) => ({
      ...e,
      expenseDate: e.expenseDate.toISOString(),
    })),
  };

  return (
    <AppShell pageTitle="Dashboard">
      <DashboardView initialData={initialData} />
    </AppShell>
  );
}
