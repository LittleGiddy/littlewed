import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');
  const status = searchParams.get('status');
  const channel = searchParams.get('channel');

  // Build filter
  const where: any = {
    event: { tenantId },
  };

  if (eventId) where.eventId = eventId;
  if (channel) where.routingChannel = channel;

  // Status filter: pending (not sent), sent (sent but not checked in), checked_in
  if (status === 'pending') {
    where.invitationSentAt = null;
  } else if (status === 'sent') {
    where.invitationSentAt = { not: null };
    where.checkedIn = false;
  } else if (status === 'checked_in') {
    where.checkedIn = true;
  }

  const guests = await prisma.guest.findMany({
    where,
    include: {
      event: {
        select: {
          id: true,
          name: true,
          date: true,
        },
      },
    },
    orderBy: { invitationSentAt: 'desc' },
  });

  return NextResponse.json(guests);
}