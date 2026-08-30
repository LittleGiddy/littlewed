// app/api/invitations/send-whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWeddingInvitation } from '@/lib/whatsapp/index';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { guestId, eventId } = await req.json();

    if (!guestId || !eventId) {
      return NextResponse.json({ error: 'Guest ID and Event ID are required' }, { status: 400 });
    }

    // ─── Fetch guest with event ──────────────────────────────────────────
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, event: { tenantId } },
      include: {
        event: {
          include: {
            tenant: { select: { bypassPayment: true } },
          },
        },
      },
    });

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    if (!guest.phone) {
      return NextResponse.json({ error: 'Guest has no phone number' }, { status: 400 });
    }

    if (guest.routingChannel !== 'whatsapp') {
      return NextResponse.json({
        error: `Guest is not configured for WhatsApp. Channel: ${guest.routingChannel}`,
      }, { status: 400 });
    }

    // ─── Once-per-channel guard (non-bypassed tenants) ───────────────────
    // Failed attempts never set whatsappSentAt, so failed invites can always
    // be retried. Bypassed tenants may resend freely.
    const isBypassed = guest.event?.tenant?.bypassPayment === true;
    if (!isBypassed && guest.whatsappSentAt) {
      return NextResponse.json({
        error: 'This guest has already received their WhatsApp invitation (one invitation per guest per channel on your plan).',
      }, { status: 400 });
    }

    // ─── Format date properly ──────────────────────────────────────────
    const formattedDate = guest.event?.date
      ? new Date(guest.event.date).toLocaleDateString('sw-TZ', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';

    // ─── Build guest full name ──────────────────────────────────────────
    const guestFullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;

    // ─── Build dynamic card URL using pass code ─────────────────────────
    const cardImageUrl = guest.passCode 
      ? `https://littlewed.co.tz/api/og/card?code=${guest.passCode}`
      : (guest.invitationCard || guest.event?.imageUrl || '');

    // ─── Send WhatsApp invitation (no link button) ──────────────────────
    // Variable values come from the user's event/guest data - no hardcoded
    // fallbacks. Empty fields send empty values to the template.
    const result = await sendWeddingInvitation(guest.phone, {
      guestName: guestFullName,
      hostFamily: guest.event?.hostFamily || '',
      person1: guest.event?.person1 || '',
      person2: guest.event?.person2 || '',
      date: formattedDate,
      venue: guest.event?.venue || '',
      time: guest.event?.time || '',
      cardNumber: guest.cardNumber || '',
      cardType:
        guest.guestType === 'DOUBLE' ? 'Double' : guest.guestType === 'SINGLE' ? 'Single' : '',
      imageUrl: cardImageUrl || undefined,  // ✅ Card image rendered in WhatsApp (omitted if none)
      // No inviteLink - removed!
    });

    if (result.success) {
      // ─── Create MessageLog for tracking ──────────────────────────────
      if (result.messageId) {
        await prisma.messageLog.create({
          data: {
            messageId: result.messageId,
            guestId: guest.id,
            type: 'WHATSAPP',
            template: 'swahili invitation',
            status: 'SENT',
            rawData: result.data,
          },
        });
      }

      await prisma.guest.update({
        where: { id: guest.id },
        data: { invitationSentAt: new Date(), whatsappSentAt: new Date(), lastSendStatus: 'SENT', lastSendError: null },
      });

      return NextResponse.json({
        success: true,
        message: 'Invitation sent successfully!',
        data: result.data,
        messageId: result.messageId,
        cardImageUrl,
      });
    } else {
      // ─── Log the failure ──────────────────────────────────────────────
      console.error('[WhatsApp] Failed to send to', guest.phone, result.error);
      
      if (result.messageId) {
        await prisma.messageLog.create({
          data: {
            messageId: result.messageId,
            guestId: guest.id,
            type: 'WHATSAPP',
            template: 'swahili invitation',
            status: 'FAILED',
            error: result.error || 'Unknown error',
            rawData: result.data,
          },
        });
      }

      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to send WhatsApp message',
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Send WhatsApp error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}