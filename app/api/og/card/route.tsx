// app/api/og/card/route.tsx
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const guestId = searchParams.get('guestId');
    const code = searchParams.get('code');
    
    let guest;
    
    // ─── Try guestId first, then fall back to code ──────────────────────
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
      return new Response('Missing guestId or code parameter', { status: 400 });
    }

    if (!guest) {
      return new Response(`Guest not found: ${guestId || code}`, { status: 404 });
    }

    console.log('[OG Card] Guest found:', guest.id, guest.name);

    const event = guest.event;
    
    if (!event.templateCardUrl) {
      return new Response('No invitation card template configured', { status: 400 });
    }

    const guestName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
    
    // ─── Safely get event date ──────────────────────────────────────────
    let eventDate = '';
    try {
      if (event.date) {
        eventDate = new Date(event.date).toLocaleDateString('sw-TZ', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }
    } catch (e) {
      console.warn('[OG Card] Date parsing error:', e);
    }

    // ─── Generate QR code ──────────────────────────────────────────────────
    let qrBase64 = '';
    try {
      const qrData = JSON.stringify({
        guestId: guest.id,
        eventId: event.id,
        cardNumber: guest.cardNumber,
        passCode: guest.passCode,
      });
      
      const qrBuffer = await QRCode.toBuffer(qrData, {
        width: 200,
        errorCorrectionLevel: 'H',
      });
      qrBase64 = qrBuffer.toString('base64');
    } catch (qrError) {
      console.error('[OG Card] QR error:', qrError);
    }

    // ─── Get design settings ──────────────────────────────────────────────
    const templateUrl = event.templateCardUrl;
    const overlayColor = event.overlayColor || '#000000';
    const overlayOpacity = event.overlayOpacity || 0.2;
    
    // ─── SAFELY PARSE design layers ──────────────────────────────────────
    let designLayers: any[] = [];
    try {
      if (event.designLayers) {
        if (typeof event.designLayers === 'string') {
          designLayers = JSON.parse(event.designLayers);
        } else if (Array.isArray(event.designLayers)) {
          designLayers = event.designLayers;
        }
      }
    } catch (e) {
      console.warn('[OG Card] Layer parse error:', e);
      designLayers = [];
    }

    // ─── QR position ──────────────────────────────────────────────────────
    const qrPosition = {
      x: event.qrPlacementX ?? 50,
      y: event.qrPlacementY ?? 70,
      size: Math.min(event.qrSize ?? 120, 200),
    };

    // ─── DEBUG: Return a simple card first ─────────────────────────────
    // This will help us confirm if ImageResponse works at all
    
    const cardContent = (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          padding: '40px',
        }}
      >
        {/* Background Image */}
        {templateUrl && (
          <img
            src={templateUrl}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        )}

        {/* Overlay */}
        {overlayOpacity > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: overlayColor,
              opacity: overlayOpacity,
            }}
          />
        )}

        {/* Guest Name - always show this */}
        <div
          style={{
            position: 'absolute',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '48px',
            fontFamily: 'Georgia, serif',
            color: '#ffffff',
            textAlign: 'center',
            textShadow: '2px 2px 8px rgba(0,0,0,0.8)',
            width: '80%',
            zIndex: 10,
          }}
        >
          {guestName}
        </div>

        {/* QR Code */}
        {qrBase64 && (
          <img
            src={`data:image/png;base64,${qrBase64}`}
            style={{
              position: 'absolute',
              bottom: '200px',
              right: '50px',
              width: '120px',
              height: '120px',
              zIndex: 10,
            }}
          />
        )}

        {/* Debug info - remove this later */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            fontSize: '12px',
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'monospace',
            zIndex: 10,
          }}
        >
          Guest: {guest.id}
        </div>
      </div>
    );

    // ─── Return the image ──────────────────────────────────────────────────
    return new ImageResponse(cardContent, {
      width: 800,
      height: 1200,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });

  } catch (error: any) {
    console.error('[OG Card] Error:', error);
    // Return a plain text error response so we can see it
    return new Response(
      `Error: ${error.message}\n\nStack: ${error.stack || 'No stack'}`,
      { 
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      }
    );
  }
}