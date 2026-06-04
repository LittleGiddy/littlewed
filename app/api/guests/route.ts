import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST: add a single guest
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = (session.user as any).tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const { name, phone, eventId } = await req.json();
    if (!name || !phone || !eventId) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
    }

    // Verify the event belongs to the tenant
    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Determine routing channel: if phone looks like WhatsApp (has + and digits), default to SMS unless you have a validator.
    // For now, we default to 'sms'. Later you can integrate Twilio Lookup.
    const routingChannel = 'sms';

    const guest = await prisma.guest.create({
      data: {
        name,
        phone,
        eventId,
        routingChannel,
      },
    });

    return NextResponse.json(guest, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/guests error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET: list guests for an event (used by send page)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = (session.user as any).tenantId;
    const { searchParams } = new URL(req.url);
    const eventId = searchParams.get('eventId');
    if (!eventId) {
      return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });
    }

    const guests = await prisma.guest.findMany({
      where: { eventId, event: { tenantId } },
      select: { id: true, name: true, phone: true, routingChannel: true, invitationCard: true, smsCode: true, checkedIn: true },
    });
    return NextResponse.json(guests);
  } catch (error: any) {
    console.error('GET /api/guests error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}