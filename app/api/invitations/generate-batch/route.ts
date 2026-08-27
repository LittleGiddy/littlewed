// app/api/invitations/generate-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateUniquePassCode } from '@/lib/utils';
import { fetchTemplateBuffer, generateCardForGuest, runWithConcurrency } from '@/lib/image-storage';

export const runtime = 'nodejs';
export const maxDuration = 300; // Hobby-plan max — a safety net, not the main strategy
const CONCURRENCY = 5;          // simultaneous sharp/Cloudinary/db ops — keep Neon happy
const MAX_PER_REQUEST = 50;     // client chunks the full guest list into pieces this size

// Fail fast if Cloudinary isn't configured, instead of failing silently
// for every guest inside the upload step.
function cloudinaryConfigured(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME) missing.push('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME');
  if (!process.env.CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
  if (!process.env.CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');
  return { ok: missing.length === 0, missing };
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cloudinaryCheck = cloudinaryConfigured();
    if (!cloudinaryCheck.ok) {
      console.error('[generate-batch] Cloudinary is not configured. Missing:', cloudinaryCheck.missing);
      return NextResponse.json(
        {
          error: `Card generation is unavailable because Cloudinary is not configured. Missing environment variables: ${cloudinaryCheck.missing.join(', ')}. Add them in Vercel → Settings → Environment Variables.`,
        },
        { status: 500 }
      );
    }

    const tenantId = (session.user as any).tenantId;
    const { eventId, guestIds } = await req.json();

    if (!eventId || !guestIds || !Array.isArray(guestIds)) {
      return NextResponse.json({ error: 'Event ID and guest IDs are required' }, { status: 400 });
    }
    if (guestIds.length > MAX_PER_REQUEST) {
      return NextResponse.json(
        { error: `Send at most ${MAX_PER_REQUEST} guestIds per request — chunk client-side.` },
        { status: 400 }
      );
    }

    const event = await prisma.event.findFirst({ 
      where: { id: eventId, tenantId } 
    });
    
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (!event.templateCardUrl) {
      return NextResponse.json({ error: 'No invitation card template configured' }, { status: 400 });
    }

    const guests = await prisma.guest.findMany({
      where: { id: { in: guestIds }, eventId, invitationCard: null },
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

    // Template fetched ONCE for this whole chunk, not once per guest.
    let cardBuffer: Buffer;
    try {
      cardBuffer = await fetchTemplateBuffer(event.templateCardUrl);
    } catch (error: any) {
      return NextResponse.json(
        { error: `Could not load template image: ${error.message}` }, 
        { status: 400 }
      );
    }

    const results = await runWithConcurrency(guests, CONCURRENCY, async (guest) => {
      try {
        const passCode = guest.passCode || (await generateUniquePassCode(prisma));
        
        // ─── Generate the card using the Cloudinary-enabled function ─────
        // This handles: QR with rotation, text layers, overlay, guest type badge, etc.
        // The image is now uploaded to Cloudinary instead of Vercel Blob
        const imageUrl = await generateCardForGuest(guest, event, cardBuffer);

        await prisma.guest.update({
          where: { id: guest.id },
          data: { 
            passCode, 
            invitationCard: imageUrl,
          },
        });

        return { 
          guestId: guest.id, 
          name: guest.name, 
          passCode, 
          imageUrl, 
          success: true 
        };
      } catch (error: any) {
        console.error(`Failed to generate card for ${guest.name}:`, error.message);
        return { 
          guestId: guest.id, 
          name: guest.name, 
          success: false, 
          error: error.message || 'Unknown error',
        };
      }
    });

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