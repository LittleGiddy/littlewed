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

    // ─── Fetch guests - check if they have cards ──────────────────────
    const guests = await prisma.guest.findMany({
      where: {
        id: { in: guestIds },
        eventId,
      },
    });

    if (guests.length === 0) {
      return NextResponse.json({ error: 'No guests found' }, { status: 404 });
    }

    const results = [];
    let completed = 0;
    let failed = 0;
    let skipped = 0;

    for (const guest of guests) {
      try {
        // ─── Skip if guest already has a card ──────────────────────────
        if (guest.invitationCard) {
          console.log(`[Generate] ⏭️ Skipping ${guest.name} - already has card`);
          skipped++;
          results.push({
            guestId: guest.id,
            name: guest.name,
            success: true,
            skipped: true,
            message: 'Already has card',
            cardUrl: guest.invitationCard,
          });
          continue;
        }

        // ─── Generate pass code if not already set ──────────────────────
        let passCode = guest.passCode;

        if (!passCode) {
          passCode = await generateUniquePassCode(prisma);
          await prisma.guest.update({
            where: { id: guest.id },
            data: { passCode },
          });
        }

        // ─── Generate and store the card image ──────────────────────────
        const imageUrl = await generateAndStoreCardImage(guest.id);

        // ─── Update guest with card URL ──────────────────────────────────
        await prisma.guest.update({
          where: { id: guest.id },
          data: { invitationCard: imageUrl },
        });

        completed++;
        results.push({
          guestId: guest.id,
          name: guest.name,
          passCode,
          imageUrl,
          success: true,
        });

      } catch (error: any) {
        failed++;
        console.error(`[Generate] ❌ Failed for ${guest.name}:`, error.message);
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
      completed,
      failed,
      skipped,
      total: guests.length,
      results,
      message: `${completed} generated, ${skipped} already had cards, ${failed} failed`,
    });

  } catch (error: any) {
    console.error('[Generate] ❌ Batch error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}