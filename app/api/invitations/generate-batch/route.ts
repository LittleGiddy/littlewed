// app/api/invitations/generate-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateUniquePassCode } from '@/lib/utils';
import { generateAndStoreCardImage } from '@/lib/image-storage';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { eventId, guestIds } = await req.json();

    if (!eventId || !guestIds || !Array.isArray(guestIds)) {
      return NextResponse.json({ error: 'Event ID and guest IDs are required' }, { status: 400 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // ─── Only generate for guests WITHOUT cards ──────────────────────────
    const guests = await prisma.guest.findMany({
      where: {
        id: { in: guestIds },
        eventId,
        invitationCard: null, // ✅ Only guests without cards
      },
    });

    if (guests.length === 0) {
      return NextResponse.json({
        success: true,
        completed: 0,
        failed: 0,
        message: 'All selected guests already have cards',
        results: [],
      });
    }

    const results = [];

    for (const guest of guests) {
      try {
        // ─── Generate pass code if not already set ──────────────────────
        let passCode = guest.passCode;

        if (!passCode) {
          passCode = await generateUniquePassCode(prisma);
          await prisma.guest.update({
            where: { id: guest.id },
            data: { passCode },
          });
        }

        // ─── Generate and store the card image ────────────────────────────
        const imageUrl = await generateAndStoreCardImage(guest.id);

        // ─── Build the card URL with variables for the guest ─────────────
        const guestFullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
        const eventDate = event.date ? new Date(event.date).toLocaleDateString('sw-TZ', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }) : '';

        // ✅ Store all variables that will be used for SMS/WhatsApp
        await prisma.guest.update({
          where: { id: guest.id },
          data: {
            invitationCard: imageUrl,
            // Also update any other fields that might be needed
          },
        });

        results.push({
          guestId: guest.id,
          name: guest.name,
          passCode,
          imageUrl,
          guestName: guestFullName,
          cardNumber: guest.cardNumber || '108',
          cardType: guest.guestType || 'SINGLE',
          eventName: event.name,
          eventDate: eventDate,
          venue: event.venue || 'The Embassy Hall',
          time: event.time || '5:00 PM',
          hostFamily: event.hostFamily || 'Mr & Mrs Allan Swai',
          person1: event.person1 || 'Agape',
          person2: event.person2 || 'Gladness',
          success: true,
        });

      } catch (error: any) {
        console.error(`Failed to generate card for ${guest.name}:`, error.message);
        results.push({
          guestId: guest.id,
          name: guest.name,
          success: false,
          error: error.message,
        });
      }
    }

    const completed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      completed,
      failed,
      results,
      message: `${completed} cards generated, ${failed} failed`,
    });

  } catch (error: any) {
    console.error('Generate batch error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}