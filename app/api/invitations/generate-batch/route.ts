import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { eventId, guestIds } = await req.json();

    if (!eventId || !guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
      return NextResponse.json({ error: 'Missing eventId or guestIds' }, { status: 400 });
    }

    // Verify event belongs to user
    const event = await prisma.event.findFirst({
      where: {
        id: eventId,
        tenantId: (session.user as any).tenantId,
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Fetch guests
    const guests = await prisma.guest.findMany({
      where: {
        id: { in: guestIds },
        eventId,
      },
    });

    const results = [];
    let completed = 0;
    let failed = 0;

    for (const guest of guests) {
      try {
        // ─── Method 1: If you have a direct generation function ──────
        // const cardUrl = await generateInvitationCard(guest);
        
        // ─── Method 2: Call your existing generate API ────────────────
        // This reuses your existing logic without duplicating code
        const generateRes = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/invitations/generate-single`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId: guest.id, eventId }),
        });

        const data = await generateRes.json();

        if (generateRes.ok && data.cardUrl) {
          // Update guest record with the card URL
          await prisma.guest.update({
            where: { id: guest.id },
            data: { invitationCard: data.cardUrl },
          });
          
          results.push({ guestId: guest.id, name: guest.name, success: true });
          completed++;
        } else {
          throw new Error(data.error || 'Generation failed');
        }
      } catch (error: any) {
        console.error(`Failed to generate card for ${guest.name}:`, error);
        results.push({ guestId: guest.id, name: guest.name, success: false, error: error.message });
        failed++;
      }
    }

    return NextResponse.json({
      completed,
      failed,
      results,
      total: guests.length,
    });
  } catch (error: any) {
    console.error('Batch generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Batch generation failed' },
      { status: 500 }
    );
  }
}