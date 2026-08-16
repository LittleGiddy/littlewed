// app/api/invitations/send-template/route.ts
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

    if (guest.routingChannel !== 'whatsapp') {
      return NextResponse.json({
        error: `Guest is not configured for WhatsApp. Channel: ${guest.routingChannel}`,
      }, { status: 400 });
    }

    const result = await sendWeddingInvitation(guest.phone, {
      name: guest.title ? `${guest.title} ${guest.name}` : guest.name,
      hostFamily: event.hostFamily || 'Mr & Mrs Allan Swai',
      person1: event.person1 || 'Agape',
      person2: event.person2 || 'Gladness',
      date: new Date(event.date).toLocaleDateString('sw-TZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      venue: event.venue || 'The Embassy Hall',
      time: event.time || '5:00 PM',
      cardNumber: guest.cardNumber || '108',
      cardType: guest.guestType || 'SINGLE',
      imageUrl: 'https://www.gstatic.com/webp/gallery/1.png',
      inviteLink: guest.id,
    });

    if (result.success) {
      await prisma.guest.update({
        where: { id: guest.id },
        data: { invitationSentAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: 'Invitation sent successfully!',
        data: result.data,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: result.error,
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