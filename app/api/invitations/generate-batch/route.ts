// app/api/invitations/generate-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // ─── Fetch event with all settings ──────────────────────────────────
    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // ─── Fetch guests ──────────────────────────────────────────────────
    const guests = await prisma.guest.findMany({
      where: { id: { in: guestIds }, eventId },
    });

    if (guests.length === 0) {
      return NextResponse.json({ error: 'No guests found' }, { status: 404 });
    }

    // ─── Get design settings from event ──────────────────────────────────
    const templateUrl = event.templateCardUrl;

    if (!templateUrl) {
      return NextResponse.json({ 
        error: 'No template selected. Please design a card first.' 
      }, { status: 400 });
    }

    const results = [];
    const BATCH_SIZE = 10;

    for (let i = 0; i < guests.length; i += BATCH_SIZE) {
      const batch = guests.slice(i, i + BATCH_SIZE);
      
      for (const guest of batch) {
        try {
          // ─── Build guest data for URL params ──────────────────────────
          const guestName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
          const eventDate = event.date ? new Date(event.date).toLocaleDateString('sw-TZ', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          }) : '';

          // ─── Generate card URL with guest data as query params ────────
          // This way the frontend can display the card with guest-specific data
          const cardUrl = `${templateUrl}?guestName=${encodeURIComponent(guestName)}&cardNumber=${guest.cardNumber || ''}&eventName=${encodeURIComponent(event.name)}&eventDate=${encodeURIComponent(eventDate)}&venue=${encodeURIComponent(event.venue)}&guestId=${guest.id}&eventId=${event.id}`;

          // ─── Update guest with card URL ──────────────────────────────
          await prisma.guest.update({
            where: { id: guest.id },
            data: { invitationCard: cardUrl },
          });

          results.push({
            guestId: guest.id,
            name: guest.name,
            success: true,
            cardUrl,
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

      // Small delay between batches
      if (i + BATCH_SIZE < guests.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }

    const completed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      completed,
      failed,
      results,
    });

  } catch (error: any) {
    console.error('Generate batch error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}