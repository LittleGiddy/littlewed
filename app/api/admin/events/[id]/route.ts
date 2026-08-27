import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
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
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, name: true, subdomain: true } },
        guests: {
          orderBy: { createdAt: 'desc' },
          include: {
            messageLogs: {
              select: { id: true, type: true, status: true, createdAt: true, deliveredAt: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
        _count: { select: { guests: true } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const guests = event.guests || [];
    const stats = {
      totalGuests: guests.length,
      checkedIn: guests.filter(g => g.checkedIn).length,
      invited: guests.filter(g => g.invitationSentAt).length,
      delivered: guests.filter(g => g.invitationDeliveredAt).length,
      opened: guests.filter(g => g.invitationOpenedAt).length,
      thanked: guests.filter(g => g.thanksSentAt).length,
      attending: guests.filter(g => g.attending === 'attending').length,
      pending: guests.filter(g => g.attending === 'pending').length,
      declined: guests.filter(g => g.attending === 'declined').length,
      singleGuests: guests.filter(g => g.guestType === 'SINGLE').length,
      doubleGuests: guests.filter(g => g.guestType === 'DOUBLE').length,
      totalMessages: guests.reduce((acc, g) => acc + g.messageLogs.length, 0),
      deliveredMessages: guests.reduce((acc, g) => acc + g.messageLogs.filter(l => l.status === 'DELIVERED').length, 0),
      failedMessages: guests.reduce((acc, g) => acc + g.messageLogs.filter(l => l.status === 'FAILED').length, 0),
    };

    return NextResponse.json({
      id: event.id,
      name: event.name,
      date: event.date,
      time: event.time,
      venue: event.venue,
      address: event.address,
      status: event.status,
      createdAt: event.createdAt,
      hostFamily: event.hostFamily,
      person1: event.person1,
      person2: event.person2,
      totalBudget: event.total_budget,
      commissionPaid: event.commission_paid,
      reminderSent: event.reminderSent,
      expiresAt: event.expiresAt,
      pausedAt: event.pausedAt,
      resumedAt: event.resumedAt,
      tenant: event.tenant,
      stats,
      guests: guests.map(g => ({
        id: g.id,
        name: g.name,
        email: g.email,
        phone: g.phone,
        onWhatsApp: g.onWhatsApp,
        attending: g.attending,
        checkedIn: g.checkedIn,
        checkedInAt: g.checkedInAt,
        guestType: g.guestType,
        title: g.title,
        cardNumber: g.cardNumber,
        routingChannel: g.routingChannel,
        invitationSentAt: g.invitationSentAt,
        invitationDeliveredAt: g.invitationDeliveredAt,
        thanksSentAt: g.thanksSentAt,
        reminderCount: g.reminderCount,
        totalMessages: g.messageLogs.length,
        deliveredMessages: g.messageLogs.filter(l => l.status === 'DELIVERED').length,
        failedMessages: g.messageLogs.filter(l => l.status === 'FAILED').length,
      })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
