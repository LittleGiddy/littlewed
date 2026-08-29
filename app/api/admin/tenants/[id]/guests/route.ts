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
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');

  try {
    const whereClause: any = {
      event: { tenantId: id },
    };
    if (eventId) whereClause.eventId = eventId;

    const guests = await prisma.guest.findMany({
      where: whereClause,
      include: {
        event: { select: { id: true, name: true, date: true, status: true } },
        messageLogs: {
          select: { id: true, type: true, status: true, createdAt: true, deliveredAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = guests.map(g => ({
      id: g.id,
      name: g.name,
      email: g.email,
      phone: g.phone,
      onWhatsApp: g.onWhatsApp,
      attending: g.attending,
      checkedIn: g.checkedIn,
      checkedInAt: g.checkedInAt,
      guestType: g.guestType,
      cardNumber: g.cardNumber,
      routingChannel: g.routingChannel,
      invitationSentAt: g.invitationSentAt,
      invitationDeliveredAt: g.invitationDeliveredAt,
      invitationOpenedAt: g.invitationOpenedAt,
      thanksSentAt: g.thanksSentAt,
      reminderCount: g.reminderCount,
      createdAt: g.createdAt,
      event: g.event,
      messageLogs: g.messageLogs,
      totalMessages: g.messageLogs.length,
      deliveredMessages: g.messageLogs.filter(l => l.status === 'DELIVERED').length,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
