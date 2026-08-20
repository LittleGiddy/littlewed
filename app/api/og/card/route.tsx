// app/api/og/card/route.tsx
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const guestId = searchParams.get('guestId');
    const code = searchParams.get('code');
    
    // ─── Find the guest ──────────────────────────────────────────────
    let guest;
    
    if (guestId) {
      guest = await prisma.guest.findUnique({
        where: { id: guestId },
        include: { event: true },
      });
    } else if (code) {
      guest = await prisma.guest.findFirst({
        where: { passCode: code },
        include: { event: true },
      });
    } else {
      return new Response('Missing guestId or code', { status: 400 });
    }

    if (!guest) {
      return new Response(`Guest not found`, { status: 404 });
    }

    const event = guest.event;
    
    if (!event.templateCardUrl) {
      return new Response('No template configured', { status: 400 });
    }

    const guestName = guest.title ? `${guest.title} ${guest.name}` : guest.name;

    // ─── Return the image ────────────────────────────────────────────
    return new ImageResponse(
      (
        <div
          style={{
            width: '800px',
            height: '1200px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            position: 'relative',
            fontFamily: 'Georgia, serif',
          }}
        >
          {/* Background Image */}
          <img
            src={event.templateCardUrl}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />

          {/* Overlay */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: event.overlayColor || '#000000',
              opacity: event.overlayOpacity || 0.2,
            }}
          />

          {/* Guest Name */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize: '48px',
              color: '#ffffff',
              textAlign: 'center',
              textShadow: '2px 2px 8px rgba(0,0,0,0.8)',
              width: '80%',
              fontWeight: 'bold',
              zIndex: 10,
            }}
          >
            {guestName}
          </div>

          {/* Card Number */}
          {guest.cardNumber && (
            <div
              style={{
                position: 'absolute',
                bottom: '40px',
                right: '40px',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.6)',
                fontFamily: 'monospace',
                zIndex: 10,
              }}
            >
              #{guest.cardNumber}
            </div>
          )}
        </div>
      ),
      {
        width: 800,
        height: 1200,
        headers: {
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
        },
      }
    );
  } catch (error: any) {
    console.error('[OG Card] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
}