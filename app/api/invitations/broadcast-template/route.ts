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
    const { eventId } = await req.json();

    if (!eventId) {
      return NextResponse.json({ error: 'Event ID is required' }, { status: 400 });
    }

    // Fetch event and guests
    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
      include: {
        guests: {
          where: {
            routingChannel: 'whatsapp',
            phone: { not: null }, // ✅ Only guests with phone numbers
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.guests.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No WhatsApp guests found for this event',
      });
    }

    // Send to each guest
    const results = [];
    let successCount = 0;

    for (const guest of event.guests) {
      try {
        // ✅ Guest.phone is guaranteed to exist due to the where filter
        const result = await sendInvitationTemplate(
          {
            phone: guest.phone!,
            name: guest.name,
            cardNumber: guest.cardNumber,
            title: guest.title,
          },
          {
            name: event.name,
            date: event.date,
            venue: event.venue,
            time: event.time || undefined,
            hostFamily: event.hostFamily || undefined,
            person1: event.person1 || undefined,
            person2: event.person2 || undefined,
            imageUrl: event.imageUrl || undefined,
          }
        );

        if (result.success) {
          await prisma.guest.update({
            where: { id: guest.id },
            data: { invitationSentAt: new Date() },
          });
          successCount++;
        }

        results.push({
          guestId: guest.id,
          name: guest.name,
          success: result.success,
          error: result.error,
        });

        // Rate limiting delay
        await new Promise((resolve) => setTimeout(resolve, 300));
      } catch (error: any) {
        results.push({
          guestId: guest.id,
          name: guest.name,
          success: false,
          error: error.message,
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: event.guests.length,
      sent: successCount,
      failed: event.guests.length - successCount,
      results,
    });
  } catch (error: any) {
    console.error('Broadcast template error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}