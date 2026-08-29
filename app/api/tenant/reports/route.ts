import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== 'CLIENT' && role !== 'STAFF') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const tenantId = (session.user as any).tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'No tenant associated' }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true, plan: true, credits: true },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const now = new Date();
    const months: { month: string; start: Date; end: Date }[] = [];

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const label = start.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      months.push({ month: label, start, end });
    }

    const monthStart = months[0].start;
    const monthEnd = months[months.length - 1].end;

    const [events, guests, transactions] = await Promise.all([
      prisma.event.findMany({
        where: { tenantId, createdAt: { gte: monthStart, lte: monthEnd } },
        select: { id: true, createdAt: true, guestCount: true },
      }),
      prisma.guest.findMany({
        where: {
          event: { tenantId },
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        select: { id: true, checkedIn: true, invitationSentAt: true, createdAt: true, eventId: true },
      }),
      prisma.transaction.findMany({
        where: { tenantId, createdAt: { gte: monthStart, lte: monthEnd } },
        select: { id: true, amount: true, type: true, createdAt: true },
      }),
    ]);

    const eventMap = new Map(events.map((e) => [e.id, e]));

    const monthData = months.map(({ month, start, end }) => {
      const monthEvents = events.filter((e) => e.createdAt >= start && e.createdAt <= end);
      const monthGuests = guests.filter((g) => g.createdAt >= start && g.createdAt <= end);
      const monthTransactions = transactions.filter((t) => t.createdAt >= start && t.createdAt <= end);

      const checkedIn = monthGuests.filter((g) => g.checkedIn).length;
      const invitationsSent = monthGuests.filter((g) => g.invitationSentAt !== null).length;
      const creditsUsed = monthTransactions
        .filter((t) => t.type === 'COMMISSION_PAYMENT')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        month,
        events: monthEvents.length,
        guests: monthGuests.length,
        checkedIn,
        invitationsSent,
        creditsUsed,
        creditsRemaining: tenant.credits,
      };
    });

    const summary = monthData.reduce(
      (acc, m) => ({
        totalEvents: acc.totalEvents + m.events,
        totalGuests: acc.totalGuests + m.guests,
        totalCheckedIn: acc.totalCheckedIn + m.checkedIn,
        totalInvitationsSent: acc.totalInvitationsSent + m.invitationsSent,
        totalCreditsUsed: acc.totalCreditsUsed + m.creditsUsed,
      }),
      { totalEvents: 0, totalGuests: 0, totalCheckedIn: 0, totalInvitationsSent: 0, totalCreditsUsed: 0 }
    );

    return NextResponse.json({
      tenant: { name: tenant.name, plan: tenant.plan, credits: tenant.credits },
      months: monthData,
      summary,
    });
  } catch (error: any) {
    console.error('[Tenant Reports] GET Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load reports' },
      { status: 500 }
    );
  }
}
