import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        plan: true,
        credits: true,
        events: {
          select: {
            id: true,
            guests: {
              select: { id: true, checkedIn: true, invitationSentAt: true },
            },
          },
        },
        transactions: {
          where: { type: 'COMMISSION_PAYMENT' },
          select: { amount: true },
        },
      },
    });

    const tenantSummaries = tenants.map((t) => {
      const totalEvents = t.events.length;
      const allGuests = t.events.flatMap((e) => e.guests);
      const totalGuests = allGuests.length;
      const totalCheckedIn = allGuests.filter((g) => g.checkedIn).length;
      const totalInvitationsSent = allGuests.filter((g) => g.invitationSentAt !== null).length;
      const totalCreditsUsed = t.transactions.reduce((sum, tx) => sum + tx.amount, 0);

      return {
        id: t.id,
        name: t.name,
        plan: t.plan,
        credits: t.credits,
        events: totalEvents,
        guests: totalGuests,
        checkedIn: totalCheckedIn,
        invitationsSent: totalInvitationsSent,
        creditsUsed: totalCreditsUsed,
      };
    });

    const summary = tenantSummaries.reduce(
      (acc, t) => ({
        totalTenants: acc.totalTenants + 1,
        totalEvents: acc.totalEvents + t.events,
        totalGuests: acc.totalGuests + t.guests,
        totalCheckedIn: acc.totalCheckedIn + t.checkedIn,
        totalInvitationsSent: acc.totalInvitationsSent + t.invitationsSent,
        totalCreditsUsed: acc.totalCreditsUsed + t.creditsUsed,
      }),
      { totalTenants: 0, totalEvents: 0, totalGuests: 0, totalCheckedIn: 0, totalInvitationsSent: 0, totalCreditsUsed: 0 }
    );

    return NextResponse.json({ tenants: tenantSummaries, summary });
  } catch (error: any) {
    console.error('[Admin Reports] GET Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load reports' },
      { status: 500 }
    );
  }
}
