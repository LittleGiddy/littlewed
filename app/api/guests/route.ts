// app/api/guests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
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

    const { title, name, phone, cardNumber, email, eventId, guestType, guest2 } = await req.json();

    if (!name || !phone || !eventId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const tenantId = (session.user as any).tenantId;

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
      include: { tenant: { select: { bypassPayment: true, credits: true, creditsEnabled: true } } },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // ─── Validate guest type ──────────────────────────────────────────
    const validGuestType = guestType && ['SINGLE', 'DOUBLE'].includes(guestType.toUpperCase())
      ? guestType.toUpperCase()
      : 'SINGLE';

    const isSharedDouble = validGuestType === 'DOUBLE' && guest2 && guest2.name && guest2.phone;

    // ─── Credit check ─────────────────────────────────────────────────
    const creditsNeeded = isSharedDouble ? 2 : 1;
    const creditsDisabled = event.tenant?.creditsEnabled === false;
    if (!event.tenant?.bypassPayment || creditsDisabled) {
      const tenantCredits = creditsDisabled ? 0 : (event.tenant.credits ?? 0);
      if (tenantCredits < creditsNeeded) {
        return NextResponse.json(
          {
            error: creditsDisabled
              ? "Your account's credits have been disabled by the admin. Please contact support to re-enable them."
              : `You've run out of credits. ${isSharedDouble ? 'This card costs 2 credits' : 'Each guest costs 1 credit'}, and you have ${tenantCredits} credit${tenantCredits !== 1 ? 's' : ''}. Request more credits from the admin.`,
            needsCredits: !creditsDisabled,
            creditsDisabled,
            credits: tenantCredits,
          },
          { status: 400 }
        );
      }
    }

    // ─── Validate phone 1 ─────────────────────────────────────────────
    const phone1 = normalizePhone(phone);
    if (!phone1.isValid) {
      return NextResponse.json(
        { error: 'Invalid phone number format for guest 1. Must start with "+" and include country code.' },
        { status: 400 }
      );
    }

    // ─── Check duplicate phone (event-scoped) ─────────────────────────
    const existingPhone1 = await prisma.guest.findFirst({
      where: { eventId, phone: phone1.normalized },
    });
    if (existingPhone1) {
      return NextResponse.json(
        { error: 'Guest with this phone number already exists in this event' },
        { status: 409 }
      );
    }

    // ─── Card number assignment ────────────────────────────────────────
    let finalCardNumber = cardNumber?.trim() || null;
    if (!finalCardNumber) {
      finalCardNumber = await getNextCardNumber(eventId);
    }

    // ─── Check card number not already used in this event ──────────────
    const existingCardInEvent = await prisma.guest.findFirst({
      where: { eventId, cardNumber: finalCardNumber },
    });
    if (existingCardInEvent) {
      return NextResponse.json(
        { error: 'Card number already exists in this event. Please use a different one.' },
        { status: 409 }
      );
    }

    // ═══════════════════════════════════════════════════════════════════
    // SHARED DOUBLE CARD: two guests, one card
    // ═══════════════════════════════════════════════════════════════════
    if (isSharedDouble) {
      const phone2 = normalizePhone(guest2.phone);
      if (!phone2.isValid) {
        return NextResponse.json(
          { error: 'Invalid phone number format for second guest. Must start with "+" and include country code.' },
          { status: 400 }
        );
      }

      const existingPhone2 = await prisma.guest.findFirst({
        where: { eventId, phone: phone2.normalized },
      });
      if (existingPhone2) {
        return NextResponse.json(
          { error: 'Second guest phone number already exists in this event' },
          { status: 409 }
        );
      }

      // Can't share a phone between two guests on the same card
      if (phone1.normalized === phone2.normalized) {
        return NextResponse.json(
          { error: 'Both guests must have different phone numbers' },
          { status: 400 }
        );
      }

      const cardGroupId = randomBytes(12).toString('hex');
      const passCode1 = await generateUniquePassCode(prisma);
      const passCode2 = await generateUniquePassCode(prisma);

      const [guest1, createdGuest2] = await prisma.$transaction([
        prisma.guest.create({
          data: {
            title: title || 'Mr',
            name: name.trim(),
            phone: phone1.normalized,
            cardNumber: finalCardNumber,
            cardGroupId,
            email: email?.trim() || null,
            eventId,
            routingChannel: 'sms',
            guestType: 'DOUBLE',
            passCode: passCode1,
            qrToken: randomBytes(16).toString('hex'),
          },
        }),
        prisma.guest.create({
          data: {
            title: guest2.title || 'Mr',
            name: guest2.name.trim(),
            phone: phone2.normalized,
            cardNumber: finalCardNumber,
            cardGroupId,
            email: guest2.email?.trim() || null,
            eventId,
            routingChannel: 'sms',
            guestType: 'DOUBLE',
            passCode: passCode2,
            qrToken: randomBytes(16).toString('hex'),
          },
        }),
      ]);

      // Deduct 2 credits (1 per guest, skip if bypassPayment)
      if (!event.tenant?.bypassPayment && event.tenant?.creditsEnabled !== false) {
        await prisma.tenant.update({
          where: { id: event.tenantId },
          data: { credits: { decrement: 2 } },
        });
        await prisma.usageRecord.createMany({
          data: [
            { tenantId: event.tenantId, eventId, channel: 'guest_add', cost: 1 },
            { tenantId: event.tenantId, eventId, channel: 'guest_add', cost: 1 },
          ],
        });
      }

      const cardImageUrl = guest1.invitationCard || event?.imageUrl || '';
      const inviteLink1 = `https://littlewed.co.tz/invite/${passCode1}`;
      const inviteLink2 = `https://littlewed.co.tz/invite/${passCode2}`;

      return NextResponse.json({
        ...guest1,
        passCode: passCode1,
        cardGroupId,
        cardImageUrl,
        inviteLink: inviteLink1,
        routingChannel: 'sms',
        message: `Shared double card created. Guest 1: ${guest1.name} (${passCode1}), Guest 2: ${createdGuest2.name} (${passCode2})`,
        sharedGuest: {
          ...createdGuest2,
          passCode: passCode2,
          inviteLink: inviteLink2,
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════════
    // SINGLE GUEST (or DOUBLE without companion — legacy behaviour)
    // ═══════════════════════════════════════════════════════════════════
    const passCode = await generateUniquePassCode(prisma);

    const guest = await prisma.guest.create({
      data: {
        title: title || 'Mr',
        name: name.trim(),
        phone: phone1.normalized,
        cardNumber: finalCardNumber,
        email: email?.trim() || null,
        eventId,
        routingChannel: 'sms',
        guestType: validGuestType,
        passCode,
        qrToken: randomBytes(16).toString('hex'),
      },
    });

    // Deduct 1 credit for adding this guest (skip if bypassPayment)
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

    const cardImageUrl = guest.invitationCard || event?.imageUrl || '';
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
