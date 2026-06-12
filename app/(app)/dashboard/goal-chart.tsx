'use client';

const GOAL = 1000;

function pt(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy - r * Math.sin(rad)];
}

export default function GoalChart({ platesMonth }: { platesMonth: number }) {
  const nowBR = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const day = nowBR.getDate();
  const daysInMonth = new Date(nowBR.getFullYear(), nowBR.getMonth() + 1, 0).getDate();

  const pct = Math.min(platesMonth / GOAL, 1);
  const expected = Math.round(GOAL * (day / daysInMonth));
  const pace = expected > 0 ? platesMonth / expected : 1;

  const status =
    pace >= 1.05
      ? { label: 'Adiantado', color: '#16a34a', bg: '#dcfce7' }
      : pace >= 0.85
      ? { label: 'No ritmo', color: '#2563eb', bg: '#dbeafe' }
      : { label: 'Atrasado', color: '#dc2626', bg: '#fee2e2' };

  const cx = 100, cy = 90, r = 72, sw = 14;
  const [lx, ly] = pt(cx, cy, r, 180);
  const [rx, ry] = pt(cx, cy, r, 0);

  // full 180° background track (CCW sweep=0)
  const bgArc = `M ${lx.toFixed(1)} ${ly.toFixed(1)} A ${r} ${r} 0 0 0 ${rx.toFixed(1)} ${ry.toFixed(1)}`;

  // progress fill
  let fillArc = '';
  if (pct > 0) {
    const endDeg = 180 - pct * 180;
    const [fx, fy] = pt(cx, cy, r, endDeg);
    fillArc = `M ${lx.toFixed(1)} ${ly.toFixed(1)} A ${r} ${r} 0 0 0 ${fx.toFixed(1)} ${fy.toFixed(1)}`;
  }

  // small tick at expected-pace position
  const expDeg = 180 - Math.min(expected / GOAL, 1) * 180;
  const [t0x, t0y] = pt(cx, cy, r - sw, expDeg);
  const [t1x, t1y] = pt(cx, cy, r + 3, expDeg);

  const arcColor = pct >= 1 ? '#16a34a' : pct >= 0.5 ? '#2B7DB7' : '#F59E0B';

  return (
    <div className="flex flex-col h-full">
      {/* Gauge SVG */}
      <div className="relative flex-1 min-h-0">
        <svg viewBox="0 0 200 100" className="w-full h-full">
          {/* Track */}
          <path d={bgArc} fill="none" stroke="#E5E7EB" strokeWidth={sw} strokeLinecap="round" />
          {/* Progress fill */}
          {fillArc && (
            <path d={fillArc} fill="none" stroke={arcColor} strokeWidth={sw} strokeLinecap="round" />
          )}
          {/* Tick at expected pace */}
          <line x1={t0x} y1={t0y} x2={t1x} y2={t1y} stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" />
        </svg>

        {/* Center text overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <p className="text-4xl font-bold font-mono leading-none" style={{ color: arcColor }}>
            {Math.round(pct * 100)}%
          </p>
          <p className="text-xs text-gray-400 mt-1">
            <span className="font-semibold" style={{ color: arcColor }}>{platesMonth}</span>
            {' '}/ {GOAL} un
          </p>
        </div>
      </div>

      {/* Bottom stats */}
      <div className="flex items-center justify-between px-6 pt-1">
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Produzido</p>
          <p className="font-mono font-bold text-[#1E3A5F] text-sm">{platesMonth}</p>
        </div>
        <span
          className="text-xs font-bold px-3 py-1.5 rounded-full"
          style={{ color: status.color, background: status.bg }}
        >
          {status.label}
        </span>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Esperado hoje</p>
          <p className="font-mono font-bold text-gray-500 text-sm">{expected}</p>
        </div>
      </div>
    </div>
  );
}
