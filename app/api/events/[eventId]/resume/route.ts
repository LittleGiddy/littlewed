import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
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
    include: { tenant: true },
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const now = new Date();
  if (event.status !== 'EXPIRED' || !event.pausedAt) {
    return NextResponse.json(
      { error: 'This event cannot be resumed' },
      { status: 400 }
    );
  }

  const daysSinceExpired =
    (now.getTime() - event.pausedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceExpired > 7) {
    return NextResponse.json(
      { error: 'This event has been permanently archived and cannot be resumed' },
      { status: 400 }
    );
  }

  // ✅ Resume the event (without resumedBy)
  await prisma.event.update({
    where: { id: eventId },
    data: {
      status: 'ACTIVE',
      pausedAt: null,
      expiresAt: null,
      expiredNotified: false,
      reminderSent: false,
      resumedAt: now,
    },
  });

  return NextResponse.json({
    success: true,
    message: 'Event resumed successfully',
  });
}