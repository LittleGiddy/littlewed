import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER;
const fromSmsNumber = process.env.TWILIO_SMS_NUMBER;

if (!accountSid || !authToken || !fromNumber) {
  console.warn('Missing Twilio credentials');
}

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export async function POST(req: NextRequest) {
  try {
    const host = req.headers.get('host') || '';
    const isCloudflareTunnel =
      host.includes('trycloudflare.com') || host.includes('loca.lt');

    const { guestId, eventId } = await req.json();

    if (!guestId || !eventId) {
      return NextResponse.json(
        { error: 'Missing guestId or eventId' },
        { status: 400 }
      );
    }

    let tenantId: string | undefined;

    // ✅ Auth check for non-tunnel requests
    if (!isCloudflareTunnel) {
      const session = await getServerSession(authOptions);
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const role = (session.user as any).role;
      tenantId = (session.user as any).tenantId;

      if (role !== 'CLIENT' && role !== 'SUPER_ADMIN' && role !== 'STAFF') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      if (!tenantId) {
        return NextResponse.json(
          { error: 'Missing tenant context' },
          { status: 400 }
        );
      }
    }

    // ✅ Fetch guest and verify ownership
    const guest = await prisma.guest.findFirst({
      where: { id: guestId },
      include: { event: true },
    });

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    // ✅ Verify tenant ownership (non-tunnel only)
    if (!isCloudflareTunnel && tenantId && guest.event.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!guest.phone) {
      return NextResponse.json(
        { error: 'Guest has no phone number' },
        { status: 400 }
      );
    }

    if (!guest.invitationCard) {
      return NextResponse.json(
        { error: 'No invitation card generated yet' },
        { status: 400 }
      );
    }

    // Normalize phone to E.164
    let phone = guest.phone;
    if (!phone.startsWith('+')) phone = '+' + phone;

    if (!client) {
      return NextResponse.json(
        { error: 'Twilio client not configured' },
        { status: 500 }
      );
    }

    const messageText = `You're invited to ${guest.event.name}! Scan the QR code at the entrance.`;
    const imageUrl = guest.invitationCard;
    const channel = guest.routingChannel ?? 'sms';

    try {
      if (channel === 'whatsapp') {
        // ── WhatsApp ──────────────────────────────────────────────
        if (!fromNumber) {
          return NextResponse.json(
            { error: 'WhatsApp number not configured' },
            { status: 500 }
          );
        }

        const twilioMessage = await client.messages.create({
          body: messageText,
          from: `whatsapp:${fromNumber}`,
          to: `whatsapp:${phone}`,
          mediaUrl: [imageUrl],
        });

        console.log(`WhatsApp sent to ${phone}:`, twilioMessage.sid);

        return NextResponse.json(
          {
            success: true,
            channel: 'whatsapp',
            messageSid: twilioMessage.sid,
          },
          { status: 200 }
        );
      } else {
        // ── SMS ──────────────────────────────────────────────────
        const smsFrom = fromSmsNumber || fromNumber;
        if (!smsFrom) {
          return NextResponse.json(
            { error: 'SMS number not configured' },
            { status: 500 }
          );
        }

        const twilioMessage = await client.messages.create({
          body: messageText,
          from: smsFrom,
          to: phone,
          mediaUrl: [imageUrl],
        });

        console.log(`SMS sent to ${phone}:`, twilioMessage.sid);

        return NextResponse.json(
          {
            success: true,
            channel: 'sms',
            messageSid: twilioMessage.sid,
          },
          { status: 200 }
        );
      }
    } catch (twilioError: any) {
      console.error(
        `Twilio error (${channel}) for ${phone}:`,
        twilioError.message
      );
      return NextResponse.json(
        { error: `Twilio failed: ${twilioError.message}` },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error('POST /api/send-invitation error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}