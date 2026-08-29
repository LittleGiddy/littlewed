// app/api/invitations/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateQRFromCardNumber, compositeQROnCard } from '@/lib/qr';
import { fetchTemplateBuffer, generateCardForGuest } from '@/lib/image-storage';
import { logSystemEvent } from '@/lib/systemLog';

// ─── Helper: Get formatted guest name ──────────────────────────────────
function getGuestFullName(guest: any): string {
  const title = guest.title || '';
  return title ? `${title} ${guest.name}` : guest.name;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
    }

    const { eventId, guestIds } = await req.json();

    if (!eventId || !guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
      return NextResponse.json({ error: 'Missing eventId or guestIds' }, { status: 400 });
    }

    // ─── Fetch event with only the specified guests ────────────────────
    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
      include: {
        guests: {
          where: {
            id: { in: guestIds },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.templateCardUrl) {
      return NextResponse.json(
        { error: 'No invitation card configured for this event. Please design it first.' },
        { status: 400 }
      );
    }

    if (event.guests.length === 0) {
      return NextResponse.json({
        completed: 0,
        failed: 0,
        results: [],
        message: 'No guests found in this batch',
      });
    }

    // ─── Fetch the base card once ──────────────────────────────────────
    let cardBuffer: Buffer;
    try {
      const response = await fetch(event.templateCardUrl);
      if (!response.ok) throw new Error(`Failed to fetch base card: ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      cardBuffer = Buffer.from(arrayBuffer);
    } catch (error) {
      console.error('Error fetching base card:', error);
      return NextResponse.json(
        { error: 'Could not load base card image. Please re‑upload the template.' },
        { status: 400 }
      );
    }

    const results: { guestId: string; name: string; success: boolean; error?: string; cardUrl?: string }[] = [];
    let completed = 0;
    let failed = 0;

    // Process guests with concurrency limit to avoid overwhelming Cloudinary
    const BATCH_SIZE = 5;
    const guestBatches = [];
    for (let i = 0; i < event.guests.length; i += BATCH_SIZE) {
      guestBatches.push(event.guests.slice(i, i + BATCH_SIZE));
    }

    for (const batch of guestBatches) {
      const batchPromises = batch.map(async (guest) => {
        try {
          // ─── Use the generateCardForGuest function ────────────────────
          // This handles: QR with rotation, text layers, overlay, guest type badge, etc.
          const imageUrl = await generateCardForGuest(guest, event, cardBuffer);

          // ─── Update database ──────────────────────────────────────────────
          await prisma.guest.update({
            where: { id: guest.id },
            data: { invitationCard: imageUrl },
          });

          const fullName = getGuestFullName(guest);
          return {
            guestId: guest.id,
            name: fullName,
            success: true,
            cardUrl: imageUrl,
          };
        } catch (error: any) {
          console.error(`Failed for ${guest.name}:`, error);
          await logSystemEvent({
            tenantId: event.tenantId,
            eventId: event.id,
            guestId: guest.id,
            type: 'card_generation',
            level: 'ERROR',
            message: `Card generation failed for ${guest.name}`,
            details: { error: error?.message || String(error) },
          });
          return {
            guestId: guest.id,
            name: guest.name,
            success: false,
            error: error.message || 'Unknown error',
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const result of batchResults) {
        if (result.success) {
          completed++;
        } else {
          failed++;
        }
        results.push(result);
      }
    }

    return NextResponse.json({
      completed,
      failed,
      results,
      total: event.guests.length,
    });
  } catch (error: any) {
    console.error('Batch generation error:', error);
    return NextResponse.json(
      { error: error.message || 'Batch generation failed' },
      { status: 500 }
    );
  }
}