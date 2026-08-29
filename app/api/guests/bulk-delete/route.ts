import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { refundCreditsForUnsentDeleted } from '@/lib/credits';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { guestIds } = await req.json();
  if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
    return NextResponse.json({ error: 'No guest IDs provided' }, { status: 400 });
  }

  const tenantId = (session.user as any).tenantId;

  // Verify these guests belong to the tenant's events
  const guests = await prisma.guest.findMany({
    where: {
      id: { in: guestIds },
      event: { tenantId },
    },
    select: { id: true, eventId: true, invitationSentAt: true },
  });

  if (guests.length === 0) {
    return NextResponse.json({ error: 'No valid guests found' }, { status: 404 });
  }

  // Only refund credits for guests that were never sent an invitation
  const refundCount = guests.filter(g => !g.invitationSentAt).length;

  const validIds = guests.map(g => g.id);
  const result = await prisma.guest.deleteMany({
    where: { id: { in: validIds } },
  });

  if (refundCount > 0) {
    const eventId = guests.find(g => g.eventId)?.eventId ?? null;
    await refundCreditsForUnsentDeleted(tenantId, eventId, refundCount);
  }

  return NextResponse.json({ count: result.count, refunded: refundCount });
}