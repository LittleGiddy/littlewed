// app/api/invitations/send-sms/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSMS } from '@/lib/sms/index';

// ─── Helper: Get full name ──────────────────────────────────────────────
function getFullName(guest: any): string {
  return guest.title ? `${guest.title} ${guest.name}` : guest.name;
}

// ─── Helper: Replace placeholders ────────────────────────────────────────
function personalizeMessage(message: string, guest: any, event: any): string {
  const fullName = getFullName(guest);
  const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return message
    .replace(/{title}/g, guest.title || '')
    .replace(/{name}/g, guest.name)
    .replace(/{fullName}/g, fullName)
    .replace(/{cardNumber}/g, guest.cardNumber || 'N/A')
    .replace(/{event}/g, event.name)
    .replace(/{date}/g, formattedDate)
    .replace(/{venue}/g, event.venue)
    .replace(/{address}/g, event.address || '');
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { guestId, eventId, message } = await req.json();

    if (!guestId || !eventId) {
      return NextResponse.json({ error: 'Guest ID and Event ID are required' }, { status: 400 });
    }

    const guest = await prisma.guest.findFirst({
      where: { id: guestId, event: { tenantId } },
    });

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!guest || !event) {
      return NextResponse.json({ error: 'Guest or Event not found' }, { status: 404 });
    }

    if (!guest.phone) {
      return NextResponse.json({ error: 'Guest has no phone number' }, { status: 400 });
    }

    if (guest.routingChannel !== 'sms') {
      return NextResponse.json({
        error: `Guest is not configured for SMS. Channel: ${guest.routingChannel}`,
      }, { status: 400 });
    }

    // ─── Personalize the message ──────────────────────────────────────────
    const personalizedMessage = personalizeMessage(
      message || "Hello {fullName}, you're invited to {event}! Card: {cardNumber}",
      guest,
      event
    );

    // ─── Send SMS via NexSMS ──────────────────────────────────────────────
    const result = await sendSMS({
      to: guest.phone,
      message: personalizedMessage,
    });

    if (result.success) {
      await prisma.guest.update({
        where: { id: guest.id },
        data: { invitationSentAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: 'SMS sent successfully!',
        data: result,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to send SMS',
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Send SMS error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}