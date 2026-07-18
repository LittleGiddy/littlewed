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

// ─── Cost Constants ────────────────────────────────────────────────
const COST_INVITATION = 300;   // per guest, from event budget
const COST_THANKS = 300;       // per thank‑you, from tenant credits

export async function POST(req: NextRequest) {
  try {
    const host = req.headers.get('host') || '';
    const isCloudflareTunnel = host.includes('trycloudflare.com') || host.includes('loca.lt');

    const { guestId, eventId, message, type = 'invitation' } = await req.json();

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
      include: {
        event: {
          include: {
            tenant: true,
          },
        },
      },
    });
    if (!guest) return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    if (!isCloudflareTunnel && tenantId && guest.event.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!guest.phone) return NextResponse.json({ error: 'Guest has no phone number' }, { status: 400 });

    const channel = guest.routingChannel || 'sms';
    const event = guest.event;

    // ─── Invitation ──────────────────────────────────────────────────
    if (type === 'invitation') {
      // 1. Check event budget (guestCount * 300 - total usage)
      const totalUsage = await prisma.usageRecord.aggregate({
        where: { eventId: event.id },
        _sum: { cost: true },
      });
      const used = totalUsage._sum.cost || 0;
      const allocated = event.guestCount ? event.guestCount * COST_INVITATION : 0;
      const remaining = allocated - used;
      if (remaining < COST_INVITATION) {
        return NextResponse.json(
          { error: `Insufficient event budget. Need ${COST_INVITATION} TZS, remaining ${remaining} TZS.` },
          { status: 402 }
        );
      }

      // 2. Ensure the required asset exists
      let cardUrl = guest.invitationCard;
      if (channel === 'whatsapp' && !cardUrl) {
        return NextResponse.json({ error: 'No invitation card generated yet' }, { status: 400 });
      }
      if (channel === 'sms') {
        let code = guest.smsCode;
        if (!code) {
          code = Math.floor(100000 + Math.random() * 900000).toString();
          await prisma.guest.update({ where: { id: guest.id }, data: { smsCode: code } });
        }
      }

      // 3. Compose message
      const baseMessage = message || guest.event.customMessage || "You're invited!";
      let messageText: string;
      let imageUrl: string | null = null;

      if (channel === 'whatsapp') {
        messageText = `${baseMessage} Scan the QR code at the entrance.`;
        imageUrl = cardUrl;
      } else {
        // SMS
        const code = guest.smsCode!;
        messageText = `${baseMessage} Your check-in code is: ${code}`;
      }

      // 4. Send via Twilio (or mock)
      let phone = guest.phone;
      if (!phone.startsWith('+')) phone = '+' + phone;

      if (!isMock) {
        if (channel === 'whatsapp') {
          if (!fromWhatsApp) return NextResponse.json({ error: 'WhatsApp number not configured' }, { status: 500 });
          await twilioClient!.messages.create({
            body: messageText,
            from: `whatsapp:${fromWhatsApp}`,
            to: `whatsapp:${phone}`,
            mediaUrl: imageUrl ? [imageUrl] : undefined,
          });
        } else {
          // SMS
          const smsFrom = fromSms || fromWhatsApp;
          if (!smsFrom) return NextResponse.json({ error: 'SMS number not configured' }, { status: 500 });
          await twilioClient!.messages.create({
            body: messageText,
            from: smsFrom,
            to: phone,
          });
        }
      } else {
        console.log(`[MOCK] ${channel} to ${phone}: ${messageText}`, imageUrl ? `image ${imageUrl}` : '');
      }

      // 5. Record usage and update guest
      await prisma.$transaction([
        prisma.usageRecord.create({
          data: {
            tenantId: event.tenantId,
            eventId: event.id,
            channel,
            cost: COST_INVITATION,
          },
        }),
        prisma.guest.update({
          where: { id: guest.id },
          data: { invitationSentAt: new Date() },
        }),
      ]);

      return NextResponse.json({ success: true, channel, cost: COST_INVITATION, type });
    }

    // ─── Thanks ──────────────────────────────────────────────────────
    if (type === 'thanks') {
      // Thanks only via WhatsApp and for checked‑in guests
      if (channel !== 'whatsapp') {
        return NextResponse.json({ error: 'Thanks can only be sent via WhatsApp' }, { status: 400 });
      }
      if (!guest.checkedIn) {
        return NextResponse.json({ error: 'Guest is not checked in' }, { status: 400 });
      }

      // Check tenant credits
      const tenant = await prisma.tenant.findUnique({
        where: { id: event.tenantId },
        select: { credits: true },
      });
      if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
      if (tenant.credits < COST_THANKS) {
        return NextResponse.json(
          { error: `Insufficient tenant credits. Need ${COST_THANKS} TZS, have ${tenant.credits} TZS.` },
          { status: 402 }
        );
      }

      // Thanks card URL
      const cardUrl = event.thankYouCardUrl || event.tenant?.thanksCardUrl || null;
      if (!cardUrl) {
        return NextResponse.json({ error: 'No thanks card uploaded for this event or tenant.' }, { status: 400 });
      }

      const baseMessage = message || event.customMessage || "Thank you for attending!";
      const messageText = baseMessage;
      let phone = guest.phone;
      if (!phone.startsWith('+')) phone = '+' + phone;

      if (!isMock) {
        if (!fromWhatsApp) return NextResponse.json({ error: 'WhatsApp number not configured' }, { status: 500 });
        await twilioClient!.messages.create({
          body: messageText,
          from: `whatsapp:${fromWhatsApp}`,
          to: `whatsapp:${phone}`,
          mediaUrl: [cardUrl],
        });
      } else {
        console.log(`[MOCK] WhatsApp thanks to ${phone}: ${messageText}, image ${cardUrl}`);
      }

      // Deduct tenant credits, update guest (no usage record)
      await prisma.$transaction([
        prisma.tenant.update({
          where: { id: event.tenantId },
          data: { credits: { decrement: COST_THANKS } },
        }),
        prisma.guest.update({
          where: { id: guest.id },
          data: { thanksSentAt: new Date() },
        }),
      ]);

      return NextResponse.json({ success: true, channel: 'whatsapp', cost: COST_THANKS, type });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (error: any) {
    console.error('POST /api/invitations/send-whatsapp error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}