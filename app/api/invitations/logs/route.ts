// app/api/invitations/logs/route.ts
// Returns WhatsApp message logs for an event, joined with guest details and
// ordered by time (newest first) so the client can display a clear log and
// sort the generated cards by send-time to see who received vs. who didn't.
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const role = (session.user as any).role;
    if (!['CLIENT', 'STAFF', 'SUPER_ADMIN'].includes(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const tenantId = (session.user as any).tenantId;
    if (!tenantId) return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });

    const url = new URL(req.url);
    const eventId = url.searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    const event = await prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500);

    const logs = await prisma.messageLog.findMany({
      where: {
        type: 'WHATSAPP',
        guest: { eventId },
      },
      select: {
        messageId: true,
        type: true,
        template: true,
        status: true,
        error: true,
        createdAt: true,
        guest: {
          select: {
            id: true,
            name: true,
            phone: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const entries = logs
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

    return NextResponse.json({ logs: entries }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    console.error('Message logs error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
