// app/api/guests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { normalizePhone } from '@/lib/phone';
import { generateUniquePassCode } from '@/lib/utils';
import { generateAndStoreCardImage } from '@/lib/image-storage';

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
  try {
    // ─── Try to check WhatsApp via NexSMS API ──────────────────────────
    const response = await fetch('https://messaging-service.co.tz/api/whatsapp/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXTSMS_TOKEN}`,
      },
      body: JSON.stringify({ phone }),
    });

    if (response.ok) {
      const data = await response.json();
      return { 
        hasWhatsApp: data.hasWhatsApp || false, 
        waId: data.waId || undefined 
      };
    }
  } catch (error) {
    console.error('WhatsApp check error:', error);
  }

  // ─── Fallback: Check if the number is in the database with WhatsApp ──
  try {
    const existingGuest = await prisma.guest.findFirst({
      where: { 
        phone,
        waId: { not: null },
      },
    });
    
    if (existingGuest) {
      return { hasWhatsApp: true, waId: existingGuest.waId || undefined };
    }
  } catch (error) {
    console.error('Database WhatsApp check error:', error);
  }

  // ─── Default: Assume WhatsApp is available for all numbers ──────────
  // This is a safe fallback since most Tanzanian numbers have WhatsApp
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
        passCode,
        qrToken: randomBytes(16).toString('hex'),
      },
    });

    // ─── AUTO-GENERATE CARD IMAGE IN BACKGROUND ────────────────────────
    let cardImageUrl = null;
    try {
      // Generate the card image and store it
      cardImageUrl = await generateAndStoreCardImage(guest.id);
      
      // Update guest with the image URL
      await prisma.guest.update({
        where: { id: guest.id },
        data: { invitationCard: cardImageUrl },
      });
    } catch (error) {
      console.error('Failed to auto-generate card image:', error);
      // Don't fail the guest creation, just log the error
      // The card can be generated later when "Generate Cards" is clicked
    }

    // ─── Build the dynamic card URL (fallback) ──────────────────────────
    const dynamicCardUrl = `https://littlewed.co.tz/api/og/card?code=${passCode}`;
    const inviteLink = `https://littlewed.co.tz/invite/${passCode}`;

    return NextResponse.json({
      ...guest,
      passCode,
      cardImageUrl: cardImageUrl || dynamicCardUrl,
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