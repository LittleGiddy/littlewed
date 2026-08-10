import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendInvitationTemplate } from '@/lib/whatsapp';

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

    // ✅ Fetch guest and event with proper includes
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, event: { tenantId } },
    });

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!guest || !event) {
      return NextResponse.json({ error: 'Guest or Event not found' }, { status: 404 });
    }

    // ✅ Check if guest has a phone number
    if (!guest.phone) {
      return NextResponse.json({
        error: 'Guest has no phone number',
      }, { status: 400 });
    }

    // Check if guest has WhatsApp routing
    if (guest.routingChannel !== 'whatsapp') {
      return NextResponse.json({
        error: `This guest is not configured for WhatsApp. Channel: ${guest.routingChannel}`,
      }, { status: 400 });
    }

    // ✅ Send the template
    const result = await sendInvitationTemplate(
      {
        phone: guest.phone,
        name: guest.name,
        cardNumber: guest.cardNumber,
        title: guest.title,
      },
      {
        name: event.name,
        date: event.date,
        venue: event.venue,
        time: undefined,
      }
    );

    if (result.success) {
      // Update guest's invitation sent status
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