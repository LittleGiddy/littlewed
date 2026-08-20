// app/api/og/card/route.tsx
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';   // required anyway since you use Prisma
export const maxDuration = 30;     // give the fetch + render pipeline room

const CARD_WIDTH = 800;
const CARD_HEIGHT = 1200;
const QR_SIZE = 120;

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const guestId = searchParams.get('guestId');
    const code = searchParams.get('code');

    let guest;
    if (guestId) {
      guest = await prisma.guest.findUnique({ where: { id: guestId }, include: { event: true } });
    } else if (code) {
      guest = await prisma.guest.findFirst({ where: { passCode: code }, include: { event: true } });
    } else {
      return new Response('Missing guestId or code parameter', { status: 400 });
    }

    if (!guest) {
      return new Response(`Guest not found: ${guestId || code}`, { status: 404 });
    }

    const event = guest.event;
    if (!event.templateCardUrl) {
      return new Response('No invitation card template configured', { status: 400 });
    }

    // ─── Pre-validate the template image BEFORE handing it to Satori ────
    // This turns a silent mid-stream Satori crash into a clean, catchable error.
    try {
      const check = await fetch(event.templateCardUrl, { method: 'HEAD' });
      const contentType = check.headers.get('content-type') || '';
      if (!check.ok) {
        throw new Error(`Template image not reachable: ${check.status}`);
      }
      if (!/image\/(png|jpe?g)/.test(contentType)) {
        throw new Error(`Template image must be PNG or JPEG, got: ${contentType}`);
      }
    } catch (imgErr: any) {
      console.error('[OG Card] Template image check failed:', imgErr.message);
      return new Response(`Template image error: ${imgErr.message}`, { status: 400 });
    }

    const guestName = guest.title ? `${guest.title} ${guest.name}` : guest.name;

    // ─── Generate QR code ────────────────────────────────────────────
    let qrBase64 = '';
    try {
      const qrData = JSON.stringify({
        guestId: guest.id,
        eventId: event.id,
        cardNumber: guest.cardNumber,
        passCode: guest.passCode,
      });
      const qrBuffer = await QRCode.toBuffer(qrData, { width: 200, errorCorrectionLevel: 'H' });
      qrBase64 = qrBuffer.toString('base64');
    } catch (qrError) {
      console.error('[OG Card] QR error:', qrError);
    }

    const overlayColor = event.overlayColor || '#000000';
    // use ?? not || so an intentional 0 (no overlay) isn't overwritten
    const overlayOpacity = event.overlayOpacity ?? 0.2;

    const cardContent = (
      <div
        style={{
          position: 'relative',           // needed so absolute children anchor correctly
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <img
          src={event.templateCardUrl}
          width={CARD_WIDTH}
          height={CARD_HEIGHT}
          style={{ position: 'absolute', top: 0, left: 0, width: CARD_WIDTH, height: CARD_HEIGHT, objectFit: 'cover' }}
        />

        {overlayOpacity > 0 && (
          <div
            style={{
              position: 'absolute', top: 0, left: 0,
              width: '100%', height: '100%',
              backgroundColor: overlayColor,
              opacity: overlayOpacity,
              display: 'flex',
            }}
          />
        )}

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
            width: '80%',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {guestName}
        </div>

        {qrBase64 && (
          <img
            src={`data:image/png;base64,${qrBase64}`}
            width={QR_SIZE}
            height={QR_SIZE}
            style={{ position: 'absolute', bottom: '200px', right: '50px' }}
          />
        )}
      </div>
    );

    return new ImageResponse(cardContent, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });

  } catch (error: any) {
    console.error('[OG Card] Error:', error);
    return new Response(`Error: ${error.message}\n\nStack: ${error.stack || 'No stack'}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}