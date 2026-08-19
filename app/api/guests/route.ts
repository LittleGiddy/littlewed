// app/api/guests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { normalizePhone } from '@/lib/phone';
import { generateUniquePassCode } from '@/lib/utils';
import { generateAndStoreCardImage } from '@/lib/image-storage';

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

    const { normalized, isValid } = normalizePhone(phone);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid phone number format. Must start with "+" and include country code.' },
        { status: 400 }
      );
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

    // ─── Check if number has WhatsApp ──────────────────────────────────
    let routingChannel = 'sms';
    try {
      // Check WhatsApp via NexSMS
      const result = await checkWhatsAppNumber(normalized);
      if (result.hasWhatsApp) {
        routingChannel = 'whatsapp';
      }
    } catch (error) {
      console.error(`WhatsApp check failed for ${normalized}:`, error);
      routingChannel = 'sms';
    }

    // ─── Generate card number ──────────────────────────────────────────
    let finalCardNumber = cardNumber?.trim() || null;
    if (!finalCardNumber) {
      finalCardNumber = await getNextCardNumber(eventId);
    }

    // ─── Generate pass code ──────────────────────────────────────────────
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
        passCode,
        qrToken: randomBytes(16).toString('hex'),
      },
    });

    // ─── AUTO-GENERATE CARD IMAGE ──────────────────────────────────────
    let cardImageUrl = null;
    try {
      // Generate the card image in the background
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

    return NextResponse.json({
      ...guest,
      passCode,
      cardImageUrl,
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