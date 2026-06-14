import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  const { eventId } = await params;
  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
    select: {
      templateCardUrl: true,
      qrPlacementX: true,
      qrPlacementY: true,
      qrSize: true,
      includeName: true,
      namePlacementX: true,
      namePlacementY: true,
      nameFontSize: true,
      nameFontColor: true,
      customMessage: true,   // ✅ new field
    },
  });
  return NextResponse.json(event || {});
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  const { eventId } = await params;
  const {
    templateCardUrl,
    qrPlacementX,
    qrPlacementY,
    qrSize,
    includeName,
    namePlacementX,
    namePlacementY,
    nameFontSize,
    nameFontColor,
    customMessage,   // ✅ new field
  } = await req.json();

  await prisma.event.updateMany({
    where: { id: eventId, tenantId },
    data: {
      templateCardUrl,
      qrPlacementX,
      qrPlacementY,
      qrSize,
      includeName: includeName ?? false,
      namePlacementX,
      namePlacementY,
      nameFontSize,
      nameFontColor: nameFontColor ?? '#000000',
      customMessage,   // ✅ new field (can be null)
    },
  });
  return NextResponse.json({ success: true });
}