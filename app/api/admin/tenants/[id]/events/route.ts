import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const events = await prisma.event.findMany({
      where: { tenantId: id },
      include: {
        _count: { select: { guests: true } },
        guests: {
          select: {
            id: true, attending: true, checkedIn: true,
            invitationSentAt: true, invitationDeliveredAt: true,
            invitationOpenedAt: true, thanksSentAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = events.map(event => {
      const guests = event.guests || [];
      return {
        id: event.id,
        name: event.name,
        date: event.date,
        venue: event.venue,
        address: event.address,
        status: event.status,
        createdAt: event.createdAt,
        hostFamily: event.hostFamily,
        person1: event.person1,
        person2: event.person2,
        totalBudget: event.total_budget,
        totalGuests: guests.length || event.guestCount || 0,
        stats: {
          totalGuests: guests.length,
          checkedIn: guests.filter(g => g.checkedIn).length,
          invited: guests.filter(g => g.invitationSentAt).length,
          delivered: guests.filter(g => g.invitationDeliveredAt).length,
          opened: guests.filter(g => g.invitationOpenedAt).length,
          thanked: guests.filter(g => g.thanksSentAt).length,
          attending: guests.filter(g => g.attending === 'attending').length,
          pending: guests.filter(g => g.attending === 'pending').length,
          declined: guests.filter(g => g.attending === 'declined').length,
        },
      };
    });

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
