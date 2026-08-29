// app/api/events/[eventId]/delivery-failures/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Returns WhatsApp messages that FAILED/REJECTED delivery for an event, joined
// with guest details, so the client can show which numbers didn't receive.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any).role;
    if (!['CLIENT', 'STAFF', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const tenantId = (session.user as any).tenantId;
    if (!tenantId) return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });

    const event = await prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const logs = await prisma.messageLog.findMany({
      where: {
        type: 'WHATSAPP',
        status: { in: ['FAILED', 'REJECTED'] },
        guest: { eventId },
      },
      select: {
        messageId: true,
        status: true,
        error: true,
        createdAt: true,
        guest: {
          select: {
            id: true,
            name: true,
            phone: true,
            routingChannel: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    const failures = logs
      .filter((l) => l.guest)
      .map((l) => ({
        messageId: l.messageId,
        status: l.status,
        error: l.error,
        sentAt: l.createdAt,
        guestId: l.guest!.id,
        name: l.guest!.name,
        phone: l.guest!.phone,
      }));

    return NextResponse.json({ failures }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    console.error('Delivery failures error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
