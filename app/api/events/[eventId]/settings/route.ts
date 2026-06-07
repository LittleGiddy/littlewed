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
  const { eventId } = await params; // ✅ awaited as required by Next.js 15[reference:1]
  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
    select: { templateCardUrl: true, qrPlacementX: true, qrPlacementY: true, qrSize: true },
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
  const { eventId } = await params; // ✅ awaited as required by Next.js 15[reference:2]
  const { templateCardUrl, qrPlacementX, qrPlacementY, qrSize } = await req.json();
  await prisma.event.updateMany({
    where: { id: eventId, tenantId },
    data: { templateCardUrl, qrPlacementX, qrPlacementY, qrSize },
  });
  return NextResponse.json({ success: true });
}