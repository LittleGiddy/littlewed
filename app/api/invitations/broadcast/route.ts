import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateGuestToken, generateQRBuffer, compositeQROnCard } from '@/lib/qr';
import twilio from 'twilio';
import fs from 'fs/promises';
import path from 'path';

// Twilio configuration
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const fromWhatsApp = process.env.TWILIO_WHATSAPP_NUMBER;
const fromSms = process.env.TWILIO_SMS_NUMBER;

// Costs (in TZS)
const COST_WHATSAPP = 50;
const COST_SMS = 25;

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
  const base64Card = finalBuffer.toString('base64');
  // Use the existing guest card upload API (which uses Vercel Blob)
  const uploadRes = await fetch(`${process.env.NEXTAUTH_URL}/api/upload-guest-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guestId: guest.id, base64Image: base64Card }),
  });
  if (!uploadRes.ok) {
    throw new Error(await uploadRes.text());
  }
  const { url } = await uploadRes.json();
  await prisma.guest.update({
    where: { id: guest.id },
    data: { invitationCard: url, qrToken: token },
  });
  return url;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = (session.user as any).tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const { eventId } = await req.json();

    // 2. Fetch event and guests
    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
      include: { guests: true },
    });
    if (!event) return NextResponse.json({ error: 'Event not found' }, { status: 404 });

    // 3. Fetch tenant settings (template and QR placement)
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        templateCardUrl: true,
        qrPlacementX: true,
        qrPlacementY: true,
        qrSize: true,
        credits: true,
      },
    });
    if (!tenant?.templateCardUrl) {
      return NextResponse.json({ error: 'No card template uploaded. Please upload in Settings.' }, { status: 400 });
    }

    // 4. Check credit balance
    const eligibleGuests = event.guests.filter(g => g.phone);
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

    // 5. Fetch base card image (from Vercel Blob URL)
    let cardBuffer: Buffer;
    try {
      const response = await fetch(tenant.templateCardUrl);
      const arrayBuffer = await response.arrayBuffer();
      cardBuffer = Buffer.from(arrayBuffer);
    } catch {
      return NextResponse.json({ error: 'Could not fetch base card image.' }, { status: 400 });
    }

    const qrPosition = {
      x: tenant.qrPlacementX ?? 100,
      y: tenant.qrPlacementY ?? 100,
      size: tenant.qrSize ?? 200,
    };

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

        // Deduct credit and record usage
        await prisma.$transaction([
          prisma.tenant.update({
            where: { id: tenantId },
            data: { credits: { decrement: cost } },
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
      await new Promise(resolve => setTimeout(resolve, 500)); // rate limit
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