import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  console.warn('Missing Twilio credentials');
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function POST(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const isCloudflareTunnel = host.includes('trycloudflare.com') || host.includes('loca.lt');

  const { guestId, eventId } = await req.json();

  let guest;
  if (isCloudflareTunnel) {
    // No auth check for tunnel
    guest = await prisma.guest.findFirst({
      where: { id: guestId },
      include: { event: true },
    });
  } else {
    // Normal auth flow
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    guest = await prisma.guest.findFirst({
      where: {
        id: guestId,
        event: { userId: session.user.id },
      },
      include: { event: true },
    });
  }

  if (!guest) {
    return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
  }
  if (!guest.phone) {
    return NextResponse.json({ error: 'Guest has no phone number' }, { status: 400 });
  }
  if (!guest.invitationCard) {
    return NextResponse.json({ error: 'No invitation card generated yet' }, { status: 400 });
  }

  // Ensure phone has + prefix
  let phone = guest.phone;
  if (!phone.startsWith('+')) phone = '+' + phone;

  const imageUrl = guest.invitationCard;

  if (!client) {
    return NextResponse.json({ error: 'Twilio client not configured' }, { status: 500 });
  }

  const messageText = `You're invited to ${guest.event.name}! Scan the QR code at the entrance.`;

  try {
    const twilioMessage = await client.messages.create({
      body: messageText,
      from: `whatsapp:${fromNumber}`,
      to: `whatsapp:${phone}`,
      mediaUrl: [imageUrl],
    });
    console.log('WhatsApp sent:', twilioMessage.sid);
    return NextResponse.json({ success: true, messageSid: twilioMessage.sid });
  } catch (error: any) {
    console.error('Twilio error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}