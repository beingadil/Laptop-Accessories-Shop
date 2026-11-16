'use client';

// Recharts lives in this module only — imported lazily by DashboardView so the
// dashboard's first load does not pay for ~392 kB of charting code.
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { formatPKR } from '@/lib/format';

export type ChartPoint = { date: string; label: string; sales: number; profit: number };

export function SalesTrendChart({ chartSeries }: { chartSeries: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartSeries}>
        <defs>
          <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748B' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
        />
        <Tooltip
          formatter={(value: number) => [formatPKR(value), 'Sales']}
          contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="#2563EB"
          strokeWidth={2}
          fill="url(#salesFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ProfitChart({ chartSeries }: { chartSeries: ChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartSeries}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 11, fill: '#64748B' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
        />
        <Tooltip
          formatter={(value: number) => [formatPKR(value), 'Net Profit']}
          contentStyle={{ borderRadius: 8, borderColor: '#E2E8F0', fontSize: 12 }}
        />
        <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
          {chartSeries.map((entry) => (
            <Cell key={entry.date} fill={entry.profit >= 0 ? '#16A34A' : '#DC2626'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
