import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const { eventId } = await params;
  console.log('API called for eventId:', eventId);

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as any).role;
    if (role !== 'CLIENT' && role !== 'STAFF' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const tenantId = (session.user as any).tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    // Verify the event belongs to the caller's tenant.
    const event = await prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const guests = await prisma.guest.findMany({
      where: { eventId },
      select: {
        id: true,
        name: true,
        title: true,
        phone: true,
        guestType: true,
        guestCount: true,
        cardNumber: true,
        passCode: true,
        invitationCard: true,
        checkedIn: true,        // ✅ Add this field
        routingChannel: true,   // ✅ Add for completeness (used in UI)
        attending: true,        // ✅ Add for completeness
        invitationSentAt: true,
        smsSentAt: true,
        whatsappSentAt: true,
        lastSendStatus: true,
        lastSendError: true,
      },
      orderBy: { name: 'asc' },
    });
    console.log('Found guests:', guests.length);

    // ✅ Prevent caching so the staff dashboard always gets fresh data
    return NextResponse.json(guests, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('Error fetching guests:', error);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}