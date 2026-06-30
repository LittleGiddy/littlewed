import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import twilio from 'twilio';

const isMock = process.env.MOCK_SMS === 'true';
console.log(`Send invitation API running in ${isMock ? 'MOCK' : 'LIVE'} mode`);

const twilioClient = isMock ? null : twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;
const fromSms = process.env.TWILIO_SMS_NUMBER;

const COST_WHATSAPP = 50;
const COST_SMS = 25;

export async function POST(req: NextRequest) {
  try {
    const host = req.headers.get('host') || '';
    const isCloudflareTunnel = host.includes('trycloudflare.com') || host.includes('loca.lt');

    const { guestId, eventId } = await req.json();
    if (!guestId || !eventId) {
      return NextResponse.json({ error: 'Missing guestId or eventId' }, { status: 400 });
    }

    let tenantId: string | undefined;

    if (!isCloudflareTunnel) {
      const session = await getServerSession(authOptions);
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const role = (session.user as any).role;
      tenantId = (session.user as any).tenantId;
      if (role !== 'CLIENT' && role !== 'SUPER_ADMIN' && role !== 'STAFF') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!tenantId) return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const guest = await prisma.guest.findFirst({
      where: { id: guestId },
      include: { event: true },
    });
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    if (!isCloudflareTunnel && tenantId && guest.event.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!guest.phone) return NextResponse.json({ error: 'Guest has no phone number' }, { status: 400 });

    const channel = guest.routingChannel || 'sms';
    const cost = channel === 'whatsapp' ? COST_WHATSAPP : COST_SMS;

    // Fetch tenant credits
    const tenant = await prisma.tenant.findUnique({
      where: { id: guest.event.tenantId },
      select: { credits: true },
    });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    if (tenant.credits < cost) {
      return NextResponse.json(
        { error: `Insufficient credits. Need ${cost} TZS, have ${tenant.credits} TZS.` },
        { status: 402 }
      );
    }

    const customMessage = guest.event.customMessage || "You're invited!";

    if (channel === 'whatsapp') {
      if (!guest.invitationCard) {
        return NextResponse.json({ error: 'No invitation card generated yet' }, { status: 400 });
      }
      const messageText = `${customMessage} Scan the QR code at the entrance.`;
      const imageUrl = guest.invitationCard;
      let phone = guest.phone;
      if (!phone.startsWith('+')) phone = '+' + phone;

      if (!isMock) {
        if (!fromWhatsApp) return NextResponse.json({ error: 'WhatsApp number not configured' }, { status: 500 });
        await twilioClient!.messages.create({
          body: messageText,
          from: `whatsapp:${fromWhatsApp}`,
          to: `whatsapp:${phone}`,
          mediaUrl: [imageUrl],
        });
      } else {
        console.log(`[MOCK] WhatsApp to ${phone}: ${messageText}, image ${imageUrl}`);
      }
    } else {
      // SMS
      let code = guest.smsCode;
      if (!code) {
        code = Math.floor(100000 + Math.random() * 900000).toString();
        await prisma.guest.update({ where: { id: guest.id }, data: { smsCode: code } });
      }
      const messageText = `${customMessage} Your check-in code is: ${code}`;
      let phone = guest.phone;
      if (!phone.startsWith('+')) phone = '+' + phone;

      if (!isMock) {
        const smsFrom = fromSms || fromWhatsApp;
        if (!smsFrom) return NextResponse.json({ error: 'SMS number not configured' }, { status: 500 });
        await twilioClient!.messages.create({
          body: messageText,
          from: smsFrom,
          to: phone,
        });
      } else {
        console.log(`[MOCK] SMS to ${phone}: ${messageText}`);
      }
    }

    // Deduct credits, record usage, and mark invitation as sent
    await prisma.$transaction([
      prisma.tenant.update({
        where: { id: guest.event.tenantId },
        data: { credits: { decrement: cost } },
      }),
      prisma.usageRecord.create({
        data: {
          tenantId: guest.event.tenantId,
          eventId: guest.event.id,
          channel,
          cost,
        },
      }),
      prisma.guest.update({
        where: { id: guest.id },
        data: { invitationSentAt: new Date() },
      }),
    ]);

    return NextResponse.json({ success: true, channel, cost });
  } catch (error: any) {
    console.error('POST /api/invitations/send-whatsapp error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}