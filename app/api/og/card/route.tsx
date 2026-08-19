// app/api/og/card/route.tsx
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';

// ─── IMPORTANT: Remove the edge runtime line ──────────────────────────────
// DO NOT use: export const runtime = 'edge';
// This will run as a serverless function with 50MB limit

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const mode = searchParams.get('mode') || 'full';
    
    if (!code) {
      return new Response('Missing code parameter', { status: 400 });
    }

    // ─── Fetch guest by pass code ──────────────────────────────────────
    const guest = await prisma.guest.findUnique({
      where: { passCode: code },
      include: { event: true },
    });

    if (!guest) {
      return new Response('Guest not found', { status: 404 });
    }

    const event = guest.event;
    const guestName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
    const eventDate = new Date(event.date).toLocaleDateString('sw-TZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    // ─── Generate QR code for check-in ──────────────────────────────────
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
    const qrBase64 = qrBuffer.toString('base64');

    // ─── Get design settings ────────────────────────────────────────────
    const overlayColor = event.overlayColor || '#000000';
    const overlayOpacity = event.overlayOpacity || 0.2;

    // ─── Render the invitation card ────────────────────────────────────
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ffffff',
            padding: '40px',
          }}
        >
          {/* Template Background */}
          {event.templateCardUrl && (
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

          {/* Content */}
          <div
            style={{
              position: 'relative',
              zIndex: 10,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
              padding: '60px',
              color: '#ffffff',
              textAlign: 'center',
            }}
          >
            {mode !== 'qr-only' && (
              <>
                <h1
                  style={{
                    fontSize: 48,
                    fontWeight: 'bold',
                    marginBottom: 20,
                    fontFamily: 'Playfair Display, serif',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                  }}
                >
                  You're Invited!
                </h1>
                
                <p
                  style={{
                    fontSize: 28,
                    marginBottom: 10,
                    fontFamily: 'Playfair Display, serif',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                  }}
                >
                  {guestName}
                </p>

                <p
                  style={{
                    fontSize: 20,
                    marginBottom: 5,
                    fontFamily: 'DM Sans, sans-serif',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                  }}
                >
                  {event.name}
                </p>

                <p
                  style={{
                    fontSize: 16,
                    marginBottom: 5,
                    fontFamily: 'DM Sans, sans-serif',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                  }}
                >
                  {eventDate}
                </p>

                <p
                  style={{
                    fontSize: 16,
                    marginBottom: 5,
                    fontFamily: 'DM Sans, sans-serif',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                  }}
                >
                  {event.venue}
                </p>

                <p
                  style={{
                    fontSize: 14,
                    marginBottom: 20,
                    fontFamily: 'DM Sans, sans-serif',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                  }}
                >
                  Card No: {guest.cardNumber} • {guest.guestType || 'SINGLE'}
                </p>
              </>
            )}

            {/* QR Code */}
            <img
              src={`data:image/png;base64,${qrBase64}`}
              style={{
                width: mode === 'qr-only' ? 300 : 120,
                height: mode === 'qr-only' ? 300 : 120,
                marginTop: 20,
              }}
            />

            {mode !== 'qr-only' && (
              <p
                style={{
                  fontSize: 12,
                  marginTop: 10,
                  fontFamily: 'DM Sans, sans-serif',
                  opacity: 0.8,
                }}
              >
                Scan to check in
              </p>
            )}

            {mode === 'qr-only' && (
              <p
                style={{
                  fontSize: 18,
                  marginTop: 20,
                  fontFamily: 'DM Sans, sans-serif',
                  opacity: 0.9,
                }}
              >
                Show this QR code at the entrance
              </p>
            )}
          </div>
        </div>
      ),
      {
        width: mode === 'qr-only' ? 400 : 800,
        height: mode === 'qr-only' ? 400 : 1200,
      }
    );
  } catch (error: any) {
    console.error('OG Card generation error:', error);
    return new Response('Error generating card: ' + error.message, { status: 500 });
  }
}