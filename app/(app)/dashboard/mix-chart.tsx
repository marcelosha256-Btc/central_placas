'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

function fmtBRL(v: number) {
  return (v ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Rosca Balcão vs Frota — total no centro, legenda com valores abaixo
export default function MixChart({ balcao, frota }: { balcao: number; frota: number }) {
  const total = (balcao ?? 0) + (frota ?? 0);
  const data = [
    { name: 'Balcão', value: balcao ?? 0, color: '#2B7DB7' },
    { name: 'Carteira (Frota)', value: frota ?? 0, color: '#F59E0B' },
  ];
  const pct = (v: number) => (total > 0 ? Math.round((v / total) * 100) : 0);

  return (
    <div className="flex flex-col h-full">
      <div className="relative flex-1 min-h-[170px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="92%" paddingAngle={3} strokeWidth={0}>
              {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            </Pie>
            <Tooltip formatter={(v: any, name: any) => [fmtBRL(Number(v)), name]} contentStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
        {/* Total no centro */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Mês</p>
          <p className="text-lg font-bold text-[#1E3A5F] font-mono leading-tight">{fmtBRL(total)}</p>
        </div>
      </div>
      {/* Legenda com valores */}
      <div className="space-y-1.5 mt-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
              {d.name} <span className="text-gray-400">({pct(d.value)}%)</span>
            </span>
            <span className="font-mono font-semibold text-[#1E3A5F]">{fmtBRL(d.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
