// app/api/invitations/generate-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateUniquePassCode } from '@/lib/utils';

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

    // ─── Fetch event to verify it exists ──────────────────────────────────
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

    const results = [];

    for (const guest of guests) {
      try {
        // ─── Generate pass code if not already set ──────────────────────
        let passCode = guest.passCode;
        
        if (!passCode) {
          passCode = await generateUniquePassCode(prisma);
          
          // ─── Update guest with pass code ──────────────────────────────
          await prisma.guest.update({
            where: { id: guest.id },
            data: { passCode },
          });
        }

        // ─── Build dynamic card URL ──────────────────────────────────────
        const cardImageUrl = `https://littlewed.co.tz/api/og/card?code=${passCode}`;

        results.push({
          guestId: guest.id,
          name: guest.name,
          passCode,
          cardImageUrl,
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