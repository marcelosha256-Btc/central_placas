export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const months = Math.min(12, Math.max(1, parseInt(searchParams.get('months') ?? '6')));

  // Monta lista de meses (atual + anteriores)
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const monthKeys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  // Pega todos os movimentos das chapas base no período
  const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const movements = await prisma.stockMovement.findMany({
    where: {
      product: { trackStock: true },
      createdAt: { gte: since },
    },
    select: {
      createdAt: true,
      type: true,
      quantity: true,
      unitCost: true,
      reversed: true,
      balance: true,
      productId: true,
      product: { select: { id: true, description: true, code: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Produtos únicos
  const productsMap: Record<string, { id: string; description: string; code: string }> = {};
  for (const m of movements) {
    productsMap[m.productId] = m.product;
  }
  const products = Object.values(productsMap);

  // Agrupa por produto × mês
  type MonthRow = {
    month: string;                 // 'YYYY-MM'
    label: string;                 // 'Jun/2026'
    entradaQty: number;
    entradaCost: number;
    saidaQty: number;              // saídas não estornadas
    avariaQty: number;             // avarias (defeito/erro)
    balanceFinal: number | null;   // saldo no final do mês (último movimento)
  };

  const result: Record<string, MonthRow[]> = {};

  for (const prod of products) {
    const rows: MonthRow[] = monthKeys.map((mk) => {
      const [y, mo] = mk.split('-').map(Number);
      const label = new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
        .replace('. ', '/').replace('.', '');
      return { month: mk, label, entradaQty: 0, entradaCost: 0, saidaQty: 0, avariaQty: 0, balanceFinal: null };
    });
    const rowByMonth: Record<string, MonthRow> = Object.fromEntries(rows.map(r => [r.month, r]));

    const prodMovs = movements.filter(m => m.productId === prod.id);

    for (const m of prodMovs) {
      const d = new Date(m.createdAt);
      const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const row = rowByMonth[mk];
      if (!row) continue;

      if (m.type === 'ENTRADA') {
        row.entradaQty += m.quantity;
        if (m.unitCost != null) row.entradaCost += m.quantity * m.unitCost;
      } else if (m.type === 'SAIDA' && !m.reversed) {
        row.saidaQty += m.quantity;
      } else if (m.type === 'AVARIA') {
        row.avariaQty += m.quantity;
      }
      // Saldo final = balance do último movimento do mês
      row.balanceFinal = m.balance;
    }

    result[prod.id] = rows;
  }

  return NextResponse.json({ products, monthKeys, report: result });
}
