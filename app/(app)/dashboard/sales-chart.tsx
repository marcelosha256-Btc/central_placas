'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';

export default function SalesChart({ data }: { data: any[] }) {
  const chartData = (data ?? [])?.map((d: any) => ({
    ...d,
    total: d?.total ?? 0,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 20 }}>
        <XAxis
          dataKey="label"
          tickLine={false}
          tick={{ fontSize: 10 }}
          interval="preserveStartEnd"
        />
        <YAxis
          tickLine={false}
          tick={{ fontSize: 10 }}
          tickFormatter={(v: number) => `R$${(v / 1000)?.toFixed?.(0) ?? '0'}k`}
        />
        <Tooltip
          formatter={(v: any) => [`R$ ${Number(v ?? 0)?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'Vendas']}
          contentStyle={{ fontSize: 11 }}
        />
        <Bar dataKey="total" fill="#2B7DB7" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
