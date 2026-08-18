// app/api/guests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { normalizePhone } from '@/lib/phone';
import { generateUniquePassCode } from '@/lib/utils';

// ─── Helper: Get the next available card number ──────────────────────────
async function getNextCardNumber(eventId: string): Promise<string> {
  const guests = await prisma.guest.findMany({
    where: { eventId },
    select: { cardNumber: true },
  });

  const numbers: number[] = [];
  for (const guest of guests) {
    if (guest.cardNumber !== null) {
      const num = parseInt(guest.cardNumber, 10);
      if (!isNaN(num)) {
        numbers.push(num);
      }
    }
  }

  numbers.sort((a, b) => a - b);

  let nextNumber = 1;
  for (const num of numbers) {
    if (num === nextNumber) {
      nextNumber++;
    } else if (num > nextNumber) {
      break;
    }
  }

  return nextNumber.toString().padStart(5, '0');
}

// ─── Helper: Check WhatsApp ──────────────────────────────────────────────
async function checkWhatsAppNumber(phone: string): Promise<{ hasWhatsApp: boolean; waId?: string; error?: string }> {
  // Since NexSMS doesn't have a direct check endpoint, assume WhatsApp is available
  return { hasWhatsApp: true };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, name, phone, cardNumber, email, eventId } = await req.json();

    // ─── Validation ──────────────────────────────────────────────────────
    if (!name || !phone || !eventId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ─── Normalize phone ──────────────────────────────────────────────────
    const { normalized, isValid } = normalizePhone(phone);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Must start with "+" and include country code.' },
        { status: 400 }
      );
    }

    // ─── Check if number has WhatsApp ──────────────────────────────────
    let routingChannel = 'sms';
    let whatsappVerified = false;
    let waId: string | undefined;

    try {
      const result = await checkWhatsAppNumber(normalized);
      if (result.hasWhatsApp) {
        routingChannel = 'whatsapp';
        whatsappVerified = true;
        waId = result.waId;
      }
    } catch (error) {
      console.error(`WhatsApp check failed for ${normalized}:`, error);
      routingChannel = 'sms';
    }

    // ─── Check duplicate phone ──────────────────────────────────────────
    const existing = await prisma.guest.findFirst({
      where: { eventId, phone: normalized },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Guest already exists in this event' },
        { status: 409 }
      );
    }

    // ─── Check duplicate card number ────────────────────────────────────
    if (cardNumber) {
      const existingCard = await prisma.guest.findUnique({
        where: { cardNumber: cardNumber.trim() },
      });
      if (existingCard) {
        return NextResponse.json(
          { error: 'Card number already exists. Please use a different one.' },
          { status: 409 }
        );
      }
    }

    // ─── Check guest limit ──────────────────────────────────────────────
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { tenant: { select: { bypassPayment: true } } },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.tenant?.bypassPayment && event.guestCount) {
      const currentCount = await prisma.guest.count({ where: { eventId } });
      if (currentCount >= event.guestCount) {
        return NextResponse.json(
          { error: `Guest limit reached (${event.guestCount}).` },
          { status: 400 }
        );
      }
    }

    // ─── Generate card number ──────────────────────────────────────────
    let finalCardNumber = cardNumber?.trim() || null;
    if (!finalCardNumber) {
      finalCardNumber = await getNextCardNumber(eventId);
    }

    // ─── Generate unique pass code ──────────────────────────────────────
    const passCode = await generateUniquePassCode(prisma);

    // ─── Create guest ────────────────────────────────────────────────────
    const guest = await prisma.guest.create({
      data: {
        title: title || 'Mr',
        name: name.trim(),
        phone: normalized,
        cardNumber: finalCardNumber,
        email: email?.trim() || null,
        eventId,
        routingChannel,
        waId: waId || null,
        passCode, // ✅ Store the unique pass code
        qrToken: randomBytes(16).toString('hex'),
      },
    });

    // ─── Build the dynamic card URL ──────────────────────────────────────
    const cardImageUrl = `https://littlewed.co.tz/api/og/card?code=${passCode}`;
    const inviteLink = `https://littlewed.co.tz/invite/${passCode}`;

    return NextResponse.json({
      ...guest,
      passCode,
      cardImageUrl,
      inviteLink,
      whatsappDetected: whatsappVerified,
      routingChannel,
    });
  } catch (error: any) {
    console.error('Add guest error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add guest' },
      { status: 500 }
    );
  }
}