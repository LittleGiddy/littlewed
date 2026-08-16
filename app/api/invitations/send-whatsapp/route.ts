// app/api/invitations/send-whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendWhatsAppTemplate, sendWeddingInvitation } from '@/lib/whatsapp/index';

// Helper: NextSMS wants only the dynamic suffix for a "Dynamic Link" button,
// not the full URL (the static prefix is baked into the approved template).
// This strips a full https://littlewed.co.tz/invite/<suffix> URL down to
// <suffix> if a full URL is passed in; if it's already just a suffix, it's
// returned unchanged.
function toLinkSuffix(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || value;
  } catch {
    // Not a full URL — assume it's already a suffix
    return value;
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { guestId, eventId, type, message, template, imageUrl, buttonUrl } = await req.json();

    if (!guestId || !eventId) {
      return NextResponse.json({ error: 'Missing guestId or eventId' }, { status: 400 });
    }

    const guest = await prisma.guest.findFirst({
      where: { id: guestId },
      include: { event: true },
    });

    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }

    if (!guest.phone) {
      return NextResponse.json({ error: 'Guest has no phone number' }, { status: 400 });
    }

    let result;

    if (type === 'thanks') {
      // Send thank you message
      result = await sendWhatsAppTemplate({
        to: guest.phone,
        template: 'thank_you',
        personalisation: [{ "1": guest.name }],
      });
    } else if (template) {
      // Send custom template
      result = await sendWhatsAppTemplate({
        to: guest.phone,
        template: template,
        personalisation: [{ "1": guest.name }],
        header: imageUrl ? { image: { file: imageUrl, name: 'Invitation' } } : undefined,
        button: buttonUrl
          ? {
              personalisation: {
                url_link: {
                  parameters: [toLinkSuffix(buttonUrl)],
                },
              },
            }
          : undefined,
      });
    } else {
      // Send wedding invitation
      result = await sendWeddingInvitation(guest.phone, {
        name: guest.name,
        hostFamily: guest.event.hostFamily || 'Mr & Mrs Allan Swai',
        person1: guest.event.person1 || 'Agape',
        person2: guest.event.person2 || 'Gladness',
        date: guest.event.date ? new Date(guest.event.date).toLocaleDateString('sw-TZ', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }) : '8 Agosti 2026',
        venue: guest.event.venue || 'The Embassy Hall',
        time: guest.event.time || '5:00 PM',
        cardNumber: guest.cardNumber || '108',
        cardType: guest.guestType || 'SINGLE',
        inviteLink: buttonUrl ? toLinkSuffix(buttonUrl) : guest.id,
      });
    }

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    // Update guest record
    await prisma.guest.update({
      where: { id: guestId },
      data: {
        invitationSentAt: new Date(),
        ...(type === 'thanks' ? { thanksSentAt: new Date() } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      message: 'WhatsApp message sent successfully',
    });
  } catch (error: any) {
    console.error('Send WhatsApp error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send WhatsApp message' },
      { status: 500 }
    );
  }
}