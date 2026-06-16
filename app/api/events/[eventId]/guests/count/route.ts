import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { tenant: { select: { bypassPayment: true } } },
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const totalGuests = await prisma.guest.count({
    where: { eventId },
  });

  const guestLimit = event.tenant?.bypassPayment ? 0 : (event.guestCount || 0);

  return NextResponse.json({
    guestCount: guestLimit,
    totalGuests,
    bypassPayment: event.tenant?.bypassPayment || false,
  });
}