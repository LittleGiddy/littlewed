import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { randomBytes } from 'crypto';
import { normalizePhone } from '@/lib/phone';

// ─── Helper: Check WhatsApp using NexSMS ──────────────────────────────
async function checkWhatsAppNumber(phone: string): Promise<{ hasWhatsApp: boolean; waId?: string; error?: string }> {
  // Since NexSMS doesn't have a direct WhatsApp check endpoint,
  // we assume WhatsApp is available and let the send API handle errors.
  // This is the simplest approach - if the number doesn't have WhatsApp,
  // the send API will return an error and we can fallback to SMS.
  return { hasWhatsApp: true };
}

export async function POST(req: NextRequest) {
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

  // ─── Check if number has WhatsApp (using NexSMS) ─────────────────────
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
    // Fallback to SMS if the check fails
    routingChannel = 'sms';
  }

  // ─── Check duplicate ──────────────────────────────────────────────────
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

  // ─── Check limit ─────────────────────────────────────────────────────
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
    const count = await prisma.guest.count({ where: { eventId } });
    finalCardNumber = `G-${String(count + 1).padStart(4, '0')}`;
  }

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
      // Store the WhatsApp ID if available
      waId: waId || null,
      smsCode: randomBytes(4).toString('hex').toUpperCase(),
      qrToken: randomBytes(16).toString('hex'),
    },
  });

  return NextResponse.json({
    ...guest,
    whatsappDetected: whatsappVerified,
    routingChannel,
  });
}