export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getFileUrl } from '@/lib/s3';

// POST: Save attachment to a cash movement
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const { movementId, cloud_storage_path } = await req.json();
    if (!movementId || !cloud_storage_path) {
      return NextResponse.json({ error: 'movementId e cloud_storage_path obrigatórios' }, { status: 400 });
    }

    const movement = await prisma.cashMovement.update({
      where: { id: movementId },
      data: { attachmentUrl: cloud_storage_path },
    });

    return NextResponse.json({ success: true, attachmentUrl: movement.attachmentUrl });
  } catch (err: any) {
    console.error('Attachment save error:', err);
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}

// GET: Get signed URL for viewing an attachment
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });

  try {
    const movementId = req.nextUrl.searchParams.get('movementId');
    if (!movementId) {
      return NextResponse.json({ error: 'movementId obrigatório' }, { status: 400 });
    }

    const movement = await prisma.cashMovement.findUnique({ where: { id: movementId } });
    if (!movement?.attachmentUrl) {
      return NextResponse.json({ error: 'Sem comprovante' }, { status: 404 });
    }

    // Determine content type from extension
    const ext = movement.attachmentUrl.split('.').pop()?.toLowerCase() ?? '';
    const contentTypeMap: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', pdf: 'application/pdf', heic: 'image/heic',
    };
    const contentType = contentTypeMap[ext] || 'application/octet-stream';

    const url = await getFileUrl(movement.attachmentUrl, contentType, false);
    return NextResponse.json({ url, contentType });
  } catch (err: any) {
    console.error('Attachment get error:', err);
    return NextResponse.json({ error: err?.message ?? 'Erro' }, { status: 500 });
  }
}
