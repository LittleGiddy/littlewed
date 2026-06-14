import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
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
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  await prisma.guest.deleteMany({ where: { eventId } });
  await prisma.event.delete({ where: { id: eventId } });

  return NextResponse.json({ success: true });
}