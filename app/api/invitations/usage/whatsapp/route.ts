// app/api/invitations/usage/whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Returns how many WhatsApp invitation messages were successfully accepted
// today (since local midnight). This powers the daily-send-limit UI so the
// client knows how many of their WhatsApp API allowance remain.
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

    // Start of today (local time, converted to Date)
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const where: any = {
      type: 'WHATSAPP',
      status: 'SENT',
      createdAt: { gte: startOfToday },
      guest: eventId ? { eventId } : { event: { tenantId } },
    };

    const todayCount = await prisma.messageLog.count({ where });

    // Also count events this event has successfully sent overall (for context)
    const eventSentCount = eventId
      ? await prisma.guest.count({
          where: { eventId, invitationSentAt: { not: null } },
        })
      : null;

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { testMode: true },
    });

    return NextResponse.json({
      todayCount,
      eventSentCount,
      date: startOfToday.toISOString(),
      testMode: tenant?.testMode ?? false,
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    console.error('WhatsApp usage error:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
