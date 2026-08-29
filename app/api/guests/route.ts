// app/api/guests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { normalizePhone } from '@/lib/phone';
import { generateUniquePassCode } from '@/lib/utils';

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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, name, phone, cardNumber, email, eventId, guestType } = await req.json();

    if (!name || !phone || !eventId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { normalized, isValid } = normalizePhone(phone);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Must start with "+" and include country code.' },
        { status: 400 }
      );
    }

    const existing = await prisma.guest.findFirst({
      where: { eventId, phone: normalized },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Guest already exists in this event' },
        { status: 409 }
      );
    }

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

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { tenant: { select: { bypassPayment: true, credits: true, creditsEnabled: true } } },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // ─── Credit check (1 credit per guest; credits are now the only limit) ─
    const creditsDisabled = event.tenant?.creditsEnabled === false;
    if (!event.tenant?.bypassPayment || creditsDisabled) {
      const tenantCredits = creditsDisabled ? 0 : (event.tenant.credits ?? 0);
      if (tenantCredits < 1) {
        return NextResponse.json(
          {
            error: creditsDisabled
              ? "Your account's credits have been disabled by the admin. Please contact support to re-enable them."
              : `You've run out of credits. Each guest costs 1 credit, and you have ${tenantCredits} credits. Request more credits from the admin to add additional guests.`,
            needsCredits: !creditsDisabled,
            creditsDisabled,
            credits: tenantCredits,
          },
          { status: 400 }
        );
      }
    }

    let finalCardNumber = cardNumber?.trim() || null;
    if (!finalCardNumber) {
      finalCardNumber = await getNextCardNumber(eventId);
    }

    const passCode = await generateUniquePassCode(prisma);

    // ─── Validate guest type ──────────────────────────────────────────
    const validGuestType = guestType && ['SINGLE', 'DOUBLE'].includes(guestType.toUpperCase())
      ? guestType.toUpperCase()
      : 'SINGLE';

    // ─── CREATE GUEST ──────────────────────────────────────────────────
    const guest = await prisma.guest.create({
      data: {
        title: title || 'Mr',
        name: name.trim(),
        phone: normalized,
        cardNumber: finalCardNumber,
        email: email?.trim() || null,
        eventId,
        routingChannel: 'sms',
        guestType: validGuestType,
        passCode,
        qrToken: randomBytes(16).toString('hex'),
      },
    });

    // ─── Deduct 1 credit for adding this guest (skip if bypassPayment) ──
    if (!event.tenant?.bypassPayment && event.tenant?.creditsEnabled !== false) {
      await prisma.tenant.update({
        where: { id: event.tenantId },
        data: { credits: { decrement: 1 } },
      });
      await prisma.usageRecord.create({
        data: {
          tenantId: event.tenantId,
          eventId,
          channel: 'guest_add',
          cost: 1,
        },
      });
    }

    const cardImageUrl = `https://littlewed.co.tz/api/og/card?code=${passCode}`;
    const inviteLink = `https://littlewed.co.tz/invite/${passCode}`;

    return NextResponse.json({
      ...guest,
      passCode,
      cardImageUrl,
      inviteLink,
      routingChannel: 'sms',
      message: `Guest added successfully. Card type: ${validGuestType}`,
    });
  } catch (error: any) {
    console.error('Add guest error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to add guest' },
      { status: 500 }
    );
  }
}
