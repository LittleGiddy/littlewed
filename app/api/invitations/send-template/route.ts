// app/api/invitations/send-template/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWeddingInvitation } from '@/lib/whatsapp/index';
import { generateAndStoreCardImage, getCardImageUrl } from '@/lib/image-storage';

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

    // ─── Ensure guest has a pass code ────────────────────────────────────
    if (!guest.passCode) {
      return NextResponse.json({
        error: 'Guest does not have a pass code. Please generate cards first.',
      }, { status: 400 });
    }

    // ─── Get card image URL (optional - for testing without header) ─────
    const cardImageUrl = guest.invitationCard || getCardImageUrl(guest.passCode);

    const formattedDate = guest.event?.date
      ? new Date(guest.event.date).toLocaleDateString('sw-TZ', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '';

    const guestFullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;

    // ─── Invite link for the button ──────────────────────────────────────
    const inviteLink = `https://littlewed.co.tz/invite/${guest.passCode}`;

    // ─── Log what we're sending ──────────────────────────────────────────
    console.log('[SendTemplate] ====== SENDING TO GUEST ======');
    console.log('[SendTemplate] Guest Name:', guestFullName);
    console.log('[SendTemplate] Phone:', guest.phone);
    console.log('[SendTemplate] Pass Code:', guest.passCode);
    console.log('[SendTemplate] Card Image URL:', cardImageUrl);
    console.log('[SendTemplate] Invite Link:', inviteLink);

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
      imageUrl: cardImageUrl,
      inviteLink: inviteLink,
    });

    console.log('[SendTemplate] Result:', JSON.stringify(result, null, 2));

    if (result.success) {
      if (result.messageId) {
        await prisma.messageLog.create({
          data: {
            messageId: result.messageId,
            guestId: guest.id,
            type: 'WHATSAPP',
            template: 'YOUR_TEMPLATE_NAME_HERE', // ⚠️ Match the template name
            status: 'SENT',
            rawData: result.data || {},
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
      console.error('[SendTemplate] Failed to send to', guest.phone, result.error);

      if (result.messageId) {
        await prisma.messageLog.create({
          data: {
            messageId: result.messageId,
            guestId: guest.id,
            type: 'WHATSAPP',
            template: 'YOUR_TEMPLATE_NAME_HERE',
            status: 'FAILED',
            error: result.error || 'Unknown error',
            rawData: result.data || {},
          },
        });
      }

      return NextResponse.json({
        success: false,
        error: result.error || 'Failed to send WhatsApp message',
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Send template error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}