// app/api/invitations/send-whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
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
      include: { event: true },
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

    // ─── Check if already sent recently ──────────────────────────────────
    if (guest.invitationSentAt) {
      const timeSinceLastSend = Date.now() - new Date(guest.invitationSentAt).getTime();
      if (timeSinceLastSend < 60000) {
        return NextResponse.json({
          success: false,
          error: 'Invitation already sent recently. Please wait before resending.',
        }, { status: 429 });
      }
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

    // ─── Send WhatsApp invitation ──────────────────────────────────────
    const result = await sendWeddingInvitation(guest.phone, {
      guestName: guestFullName,
      hostFamily: guest.event?.hostFamily || 'Mr & Mrs Allan Swai',
      person1: guest.event?.person1 || 'Agape',
      person2: guest.event?.person2 || 'Gladness',
      date: formattedDate,
      venue: guest.event?.venue || 'The Embassy Hall',
      time: guest.event?.time || '5:00 PM',
      cardNumber: guest.cardNumber || '108',
      cardType: guest.guestType || 'SINGLE',
      imageUrl: guest.invitationCard || guest.event?.imageUrl || 'https://www.gstatic.com/webp/gallery/1.png',
      inviteLink: `https://littlewed.co.tz/invite/${guest.id}`,
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
        data: { invitationSentAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: 'Invitation sent successfully!',
        data: result.data,
        messageId: result.messageId,
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