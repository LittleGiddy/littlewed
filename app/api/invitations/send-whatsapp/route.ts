import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import twilio from 'twilio';

const isMock = process.env.MOCK_SMS === 'true';
const twilioClient = isMock ? null : twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;

// ─── Helper: Get formatted guest name ──────────────────────────────────
function getGuestFullName(guest: any): string {
  const title = guest.title || 'Mr';
  return `${title} ${guest.name}`;
}

// ─── GET: List guests ────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');
  const status = searchParams.get('status');
  const channel = searchParams.get('channel');

  const where: any = {
    event: { tenantId },
  };

  if (eventId) where.eventId = eventId;
  if (channel) where.routingChannel = channel;

  if (status === 'pending') {
    where.invitationSentAt = null;
  } else if (status === 'sent') {
    where.invitationSentAt = { not: null };
    where.checkedIn = false;
  } else if (status === 'checked_in') {
    where.checkedIn = true;
  }

  const guests = await prisma.guest.findMany({
    where,
    include: {
      event: {
        select: {
          id: true,
          name: true,
          date: true,
        },
      },
    },
    orderBy: { invitationSentAt: 'desc' },
  });

  return NextResponse.json(guests);
}

// ─── POST: Send WhatsApp message to a single guest ──────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { guestId, eventId, message, type } = await req.json();

    if (!guestId || !eventId) {
      return NextResponse.json({ error: 'Missing guestId or eventId' }, { status: 400 });
    }

    // Fetch guest and event
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, event: { tenantId } },
      include: { event: true },
    });

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    if (!guest.phone) {
      return NextResponse.json({ error: 'Guest has no phone number' }, { status: 400 });
    }

    // Check if guest has an invitation card
    if (!guest.invitationCard) {
      return NextResponse.json(
        { error: 'No invitation card generated for this guest. Please generate it first.' },
        { status: 400 }
      );
    }

    const fullName = getGuestFullName(guest);
    const cardInfo = guest.cardNumber ? ` (Card: ${guest.cardNumber})` : '';
    const messageText = message || `Hello ${fullName}, your invitation is ready.${cardInfo}`;

    // Send WhatsApp message
    if (isMock) {
      console.log(`[MOCK] WhatsApp to ${guest.phone}: ${messageText}`);
    } else {
      const normalized = guest.phone.startsWith('+') ? guest.phone : `+${guest.phone}`;
      await twilioClient!.messages.create({
        body: messageText,
        from: `whatsapp:${fromWhatsApp}`,
        to: `whatsapp:${normalized}`,
        mediaUrl: [guest.invitationCard],
      });
    }

    // Update guest record
    await prisma.guest.update({
      where: { id: guestId },
      data: {
        invitationSentAt: new Date(),
        ...(type === 'thanks' ? { thanksSentAt: new Date() } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'WhatsApp message sent successfully',
    });
  } catch (error: any) {
    console.error('Send WhatsApp error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}