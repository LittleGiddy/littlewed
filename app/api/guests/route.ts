import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    console.log('Session in /api/guests:', session?.user);

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized - no session' }, { status: 401 });
    }

    const role = (session.user as any).role;
    const tenantId = (session.user as any).tenantId;

    // Allow both 'CLIENT' and 'SUPER_ADMIN' (case-insensitive optional)
    if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: `Forbidden - role: ${role}` }, { status: 403 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const { name, phone, eventId } = await req.json();
    if (!name || !phone || !eventId) {
      return NextResponse.json({ error: 'Missing name, phone, or eventId' }, { status: 400 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found or access denied' }, { status: 404 });
    }

    // Optional: detect WhatsApp number (if you have a utility)
    let routingChannel = 'sms';
    if (process.env.MOCK_WHATSAPP === 'true' && phone.startsWith('+2557')) {
      routingChannel = 'whatsapp';
    } else if (process.env.TWILIO_ACCOUNT_SID) {
      try {
        const { isWhatsAppNumber } = await import('@/lib/validate-whatsapp');
        const isWhatsApp = await isWhatsAppNumber(phone);
        routingChannel = isWhatsApp ? 'whatsapp' : 'sms';
      } catch (err) {
        console.warn('WhatsApp detection failed, defaulting to SMS');
      }
    }

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