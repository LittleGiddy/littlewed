import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ─── DELETE a single RSVP ──────────────────────────────────────────────
// The tenant owns the event, so they own the replies. Deleting the current
// RSVP also brings the guest's attending snapshot back in line with whatever
// reply (if any) is left, without touching the schema.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string; rsvpId: string }> }
) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || !role || !['CLIENT', 'SUPER_ADMIN'].includes(role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as { tenantId?: string }).tenantId;
  if (role !== 'SUPER_ADMIN' && !tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { eventId, rsvpId } = await params;

  const rsvp = await prisma.rsvp.findFirst({
    where:
      role === 'SUPER_ADMIN'
        ? { id: rsvpId, eventId }
        : { id: rsvpId, eventId, event: { tenantId } },
    select: { id: true, guestId: true, isCurrent: true },
  });

  if (!rsvp) {
    return NextResponse.json({ error: 'RSVP not found' }, { status: 404 });
  }

  await prisma.rsvp.delete({ where: { id: rsvp.id } });

  // Keep the guest list honest: if the reply we removed was the one driving
  // the guest's attending badge, fall back to any remaining current reply or
  // back to "pending".
  if (rsvp.guestId && rsvp.isCurrent) {
    const remaining = await prisma.rsvp.findFirst({
      where: { eventId, guestId: rsvp.guestId, isCurrent: true },
      orderBy: { createdAt: 'desc' },
      select: { status: true },
    });

    await prisma.guest.updateMany({
      where: { id: rsvp.guestId },
      data: { attending: remaining?.status ?? 'pending' },
    });
  }

  return NextResponse.json({ success: true });
}
