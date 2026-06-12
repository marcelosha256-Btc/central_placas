export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Get price for a product based on customer's price table
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const customerId = searchParams.get('customerId') ?? '';
  const productId = searchParams.get('productId') ?? '';

  if (!customerId || !productId) return NextResponse.json({ price: 0 });

  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { priceTableId: true } });
    if (customer?.priceTableId) {
      const item = await prisma.priceTableItem.findUnique({
        where: { priceTableId_productId: { priceTableId: customer.priceTableId, productId } },
      });
      if (item) return NextResponse.json({ price: item.price });
    }
    const product = await prisma.product.findUnique({ where: { id: productId }, select: { basePrice: true } });
    return NextResponse.json({ price: product?.basePrice ?? 0 });
  } catch {
    return NextResponse.json({ price: 0 });
  }
}
