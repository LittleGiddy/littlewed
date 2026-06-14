import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateGuestToken, generateQRBuffer, compositeQROnCard } from '@/lib/qr';
import twilio from 'twilio';

const isMock = process.env.MOCK_SMS === 'true';
console.log(`Broadcast API running in ${isMock ? 'MOCK' : 'LIVE'} mode`);

const twilioClient = isMock ? null : twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;
const fromSms = process.env.TWILIO_SMS_NUMBER;

const COST_WHATSAPP = 50;
const COST_SMS = 25;

async function sendWhatsAppInvitation(phone: string, imageUrl: string, message: string) {
  if (isMock) {
    console.log(`[MOCK] WhatsApp to ${phone}: image ${imageUrl}, message: ${message}`);
    return;
  }
  const normalized = phone.startsWith('+') ? phone : `+${phone}`;
  await twilioClient!.messages.create({
    body: message,
    from: `whatsapp:${fromWhatsApp}`,
    to: `whatsapp:${normalized}`,
    mediaUrl: [imageUrl],
  });
}

async function sendSmsCode(guest: any, message: string) {
  let code = guest.smsCode;
  if (!code) {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.guest.update({ where: { id: guest.id }, data: { smsCode: code } });
  }
  const finalMessage = `${message} Your check-in code is: ${code}`;
  if (isMock) {
    console.log(`[MOCK] SMS to ${guest.phone}: ${finalMessage}`);
    return;
  }
  const normalized = guest.phone.startsWith('+') ? guest.phone : `+${guest.phone}`;
  await twilioClient!.messages.create({
    body: finalMessage,
    from: fromSms || fromWhatsApp,
    to: normalized,
  });
}

async function generateAndSaveCard(
  guest: any,
  eventId: string,
  cardBuffer: Buffer,
  qrPosition: { x: number; y: number; size: number },
  qrColor: string
): Promise<string> {
  const token = generateGuestToken(guest.id, eventId);
  const qrBuffer = await generateQRBuffer(token, qrPosition.size, qrColor);
  const finalBuffer = await compositeQROnCard(cardBuffer, qrBuffer, qrPosition);
  const base64Card = finalBuffer.toString('base64');
  const uploadRes = await fetch(`${process.env.NEXTAUTH_URL}/api/upload-guest-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestId: guest.id, base64Image: base64Card }),
  });
  if (!uploadRes.ok) throw new Error(await uploadRes.text());
  const { url } = await uploadRes.json();
  await prisma.guest.update({
    where: { id: guest.id },
    data: { invitationCard: url, qrToken: token },
  });
  return url;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tenantId = (session.user as any).tenantId;
    if (!tenantId) return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });

    const { eventId, channel } = await req.json();
    if (!eventId) return NextResponse.json({ error: 'Missing eventId' }, { status: 400 });

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
      include: { guests: true },
    });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    const customMessage = event.customMessage || "You're invited!";
    const qrColor = event.qrColor || '#000000';

    if (!event.templateCardUrl) {
      return NextResponse.json(
        { error: 'No invitation card designed for this event. Please design it first.' },
        { status: 400 }
      );
    }

    const qrPosition = {
      x: event.qrPlacementX ?? 100,
      y: event.qrPlacementY ?? 100,
      size: event.qrSize ?? 200,
    };

    let absoluteCardUrl: string;
    if (event.templateCardUrl.startsWith('http')) {
      absoluteCardUrl = event.templateCardUrl;
    } else {
      const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
      absoluteCardUrl = `${baseUrl}${event.templateCardUrl.startsWith('/') ? '' : '/'}${event.templateCardUrl}`;
    }

    let cardBuffer: Buffer;
    try {
      const response = await fetch(absoluteCardUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      cardBuffer = Buffer.from(await response.arrayBuffer());
    } catch {
      return NextResponse.json(
        { error: 'Could not load invitation card image. Please re-upload it.' },
        { status: 400 }
      );
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { credits: true },
    });
    if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

    let eligibleGuests = event.guests.filter(g => g.phone);
    if (channel === 'whatsapp') {
      eligibleGuests = eligibleGuests.filter(g => g.routingChannel === 'whatsapp');
    } else if (channel === 'sms') {
      eligibleGuests = eligibleGuests.filter(g => g.routingChannel === 'sms');
    }

    let estimatedCost = 0;
    for (const g of eligibleGuests) {
      estimatedCost += g.routingChannel === 'whatsapp' ? COST_WHATSAPP : COST_SMS;
    }
    if (tenant.credits < estimatedCost) {
      return NextResponse.json(
        { error: `Insufficient credits. Need ${estimatedCost} TZS, have ${tenant.credits} TZS.` },
        { status: 402 }
      );
    }

    const results = [];
    let totalCost = 0;

    for (const guest of eligibleGuests) {
      const channelType = guest.routingChannel === 'whatsapp' ? 'whatsapp' : 'sms';
      const cost = channelType === 'whatsapp' ? COST_WHATSAPP : COST_SMS;
      try {
        if (channelType === 'whatsapp') {
          let cardUrl = guest.invitationCard;
          if (!cardUrl) {
            cardUrl = await generateAndSaveCard(guest, event.id, cardBuffer, qrPosition, qrColor);
          }
          const whatsappMessage = `${customMessage} Scan the QR code at the entrance.`;
          await sendWhatsAppInvitation(guest.phone!, cardUrl!, whatsappMessage);
        } else {
          await sendSmsCode(guest, customMessage);
        }

        await prisma.$transaction([
          prisma.tenant.update({ where: { id: tenantId }, data: { credits: { decrement: cost } } }),
          prisma.usageRecord.create({
            data: { tenantId, eventId: event.id, channel: channelType, cost },
          }),
        ]);
        totalCost += cost;
        results.push({ guestId: guest.id, name: guest.name, channel: channelType, success: true });
      } catch (error: any) {
        console.error(`Failed for ${guest.name}:`, error.message);
        results.push({ guestId: guest.id, name: guest.name, channel: channelType, success: false, error: error.message });
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return NextResponse.json({
      success: true,
      summary: { total: eligibleGuests.length, sent: results.filter(r => r.success).length, totalCost },
      results,
    });
  } catch (error: any) {
    console.error('Broadcast API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}