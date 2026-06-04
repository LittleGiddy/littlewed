import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { generateGuestToken, generateQRBuffer, compositeQROnCard } from '@/lib/qr';
import twilio from 'twilio';
import fs from 'fs/promises';
import path from 'path';

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;
const fromSms = process.env.TWILIO_SMS_NUMBER;

const COST_WHATSAPP = 50;   // TZS
const COST_SMS = 25;        // TZS

async function sendWhatsAppInvitation(phone: string, imageUrl: string, eventName: string) {
  const normalized = phone.startsWith('+') ? phone : `+${phone}`;
  await twilioClient.messages.create({
    body: `You're invited to ${eventName}! Scan the QR code at the entrance.`,
    from: `whatsapp:${fromWhatsApp}`,
    to: `whatsapp:${normalized}`,
    mediaUrl: [imageUrl],
  });
}

async function sendSmsCode(guest: any, eventName: string) {
  let code = guest.smsCode;
  if (!code) {
    code = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.guest.update({
      where: { id: guest.id },
      data: { smsCode: code },
    });
  }
  const normalized = guest.phone.startsWith('+') ? guest.phone : `+${guest.phone}`;
  await twilioClient.messages.create({
    body: `You're invited to ${eventName}! Your check-in code is: ${code}`,
    from: fromSms || fromWhatsApp,
    to: normalized,
  });
}

async function generateAndSaveCard(
  guest: any,
  eventId: string,
  cardBuffer: Buffer,
  qrPosition: { x: number; y: number; size: number }
): Promise<string> {
  const token = generateGuestToken(guest.id, eventId);
  const qrBuffer = await generateQRBuffer(token, qrPosition.size);
  const finalBuffer = await compositeQROnCard(cardBuffer, qrBuffer, qrPosition);

  const uploadDir = path.join(process.cwd(), 'public', 'invitations');
  await fs.mkdir(uploadDir, { recursive: true });
  const fileName = `${guest.id}.png`;
  await fs.writeFile(path.join(uploadDir, fileName), finalBuffer);

  const baseUrl = (process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '');
  const absoluteUrl = `${baseUrl}/invitations/${fileName}`;

  await prisma.guest.update({
    where: { id: guest.id },
    data: { invitationCard: absoluteUrl, qrToken: token },
  });

  return absoluteUrl;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = (session.user as any).role;
  const tenantId = (session.user as any).tenantId;
  if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
  }

  const { eventId } = await req.json();

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
    include: { guests: true },
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      subscriptionStatus: true,
      creditBalance: true,
      templateCardUrl: true,
      qrPlacementX: true,
      qrPlacementY: true,
      qrSize: true,
    },
  });
  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  if (tenant.subscriptionStatus !== 'active') {
    return NextResponse.json({ error: 'Subscription inactive. Please contact support.' }, { status: 402 });
  }

  if (!tenant.templateCardUrl) {
    return NextResponse.json({ error: 'No card template uploaded in settings.' }, { status: 400 });
  }

  const baseCardPath = path.join(process.cwd(), 'public', tenant.templateCardUrl);
  let cardBuffer: Buffer;
  try {
    cardBuffer = await fs.readFile(baseCardPath);
  } catch {
    return NextResponse.json({ error: 'Card template file not found.' }, { status: 400 });
  }

  const qrPosition = {
    x: tenant.qrPlacementX ?? 50,
    y: tenant.qrPlacementY ?? 50,
    size: tenant.qrSize ?? 150,
  };

  // Filter guests with phone numbers
  const eligibleGuests = event.guests.filter((g): g is typeof g & { phone: string } => !!g.phone);

  // Estimate total cost
  let estimatedTotal = 0;
  for (const g of eligibleGuests) {
    const channel = g.routingChannel === 'whatsapp' ? 'whatsapp' : 'sms';
    estimatedTotal += channel === 'whatsapp' ? COST_WHATSAPP : COST_SMS;
  }
  if (tenant.creditBalance < estimatedTotal) {
    return NextResponse.json(
      { error: `Insufficient credit. Need ${estimatedTotal} TZS, available ${tenant.creditBalance} TZS. Please recharge.` },
      { status: 402 }
    );
  }

  const results = [];
  let totalCost = 0;

  for (const guest of eligibleGuests) {
    const channel = guest.routingChannel === 'whatsapp' ? 'whatsapp' : 'sms';
    const cost = channel === 'whatsapp' ? COST_WHATSAPP : COST_SMS;

    try {
      if (channel === 'whatsapp') {
        let cardUrl = guest.invitationCard;
        if (!cardUrl) {
          cardUrl = await generateAndSaveCard(guest, event.id, cardBuffer, qrPosition);
        }
        await sendWhatsAppInvitation(guest.phone, cardUrl, event.name);
      } else {
        await sendSmsCode(guest, event.name);
      }

      // Atomically deduct credit and record usage
      await prisma.$transaction([
        prisma.tenant.update({
          where: { id: tenantId },
          data: { creditBalance: { decrement: cost } },
        }),
        prisma.usageRecord.create({
          data: {
            tenantId,
            eventId: event.id,
            channel,
            cost,
          },
        }),
      ]);

      totalCost += cost;
      results.push({ guestId: guest.id, name: guest.name, channel, success: true });
    } catch (error: any) {
      console.error(`Failed for ${guest.name}:`, error.message);
      results.push({ guestId: guest.id, name: guest.name, channel, success: false, error: error.message });
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const sent = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return NextResponse.json({
    success: true,
    summary: { total: eligibleGuests.length, sent, failed, totalCost },
    results,
  });
}