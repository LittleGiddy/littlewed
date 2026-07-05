import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const tenantId = (session.user as any).tenantId;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const result = await prisma.usageRecord.aggregate({
    where: { eventId },
    _sum: { cost: true },
  });

  return NextResponse.json({ totalCost: result._sum.cost || 0 });
}