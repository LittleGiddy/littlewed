// app/api/og/card/route.tsx
import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const mode = searchParams.get('mode') || 'full';
    
    if (!code) {
      return new Response('Missing code parameter', { status: 400 });
    }

    // ─── Fetch guest with event and design settings ──────────────────────
    const guest = await prisma.guest.findUnique({
      where: { passCode: code },
      include: { 
        event: true,
      },
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

    // ─── Get design settings from event ──────────────────────────────────
    // ✅ These are the settings saved from the Invitation Designer
    const templateUrl = event.templateCardUrl;
    const overlayColor = event.overlayColor || '#000000';
    const overlayOpacity = event.overlayOpacity || 0.2;
    const designLayers = event.designLayers as any[] || [];

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

          {/* ─── Design Layers ─── */}
          {designLayers.map((layer: any, index: number) => {
            if (!layer.visible) return null;
            
            const x = (layer.x / 100) * 800;
            const y = (layer.y / 100) * 1200;

            if (layer.type === 'text') {
              let text = layer.text;
              
              // ─── Replace placeholders with actual guest data ────────────
              if (layer.isGuestName) {
                text = guestName;
              } else if (layer.isGuestType) {
                text = guest.title || guest.guestType || '';
              } else if (layer.isCardNumber) {
                text = guest.cardNumber || '';
              } else {
                text = text
                  .replace(/{guestName}/g, guestName)
                  .replace(/{guestTitle}/g, guest.title || '')
                  .replace(/{cardNumber}/g, guest.cardNumber || '')
                  .replace(/{eventName}/g, event.name || '')
                  .replace(/{eventDate}/g, eventDate)
                  .replace(/{venue}/g, event.venue || '');
              }

              const fontSize = layer.fontSize || 24;
              const fontFamily = layer.fontFamily || 'Playfair Display';
              const color = layer.color || '#ffffff';
              
              return (
                <div
                  key={index}
                  style={{
                    position: 'absolute',
                    left: x,
                    top: y,
                    transform: `translate(-50%, -50%) rotate(${layer.rotation || 0}deg)`,
                    fontSize: fontSize,
                    fontFamily: fontFamily,
                    color: color,
                    textAlign: layer.align || 'center',
                    fontWeight: 'bold',
                    width: '80%',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
                  }}
                >
                  {text}
                </div>
              );
            }

            if (layer.type === 'rect') {
              const width = (layer.width / 100) * 800;
              const height = (layer.height / 100) * 1200;
              
              return (
                <div
                  key={index}
                  style={{
                    position: 'absolute',
                    left: x - width/2,
                    top: y - height/2,
                    width: width,
                    height: height,
                    backgroundColor: layer.fill || 'rgba(255,255,255,0.2)',
                    border: `${layer.borderWidth || 0}px solid ${layer.borderColor || 'transparent'}`,
                    borderRadius: '4px',
                    transform: `rotate(${layer.rotation || 0}deg)`,
                  }}
                />
              );
            }

            return null;
          })}

          {/* ─── QR Code ─── */}
          <img
            src={`data:image/png;base64,${qrBase64}`}
            style={{
              position: 'absolute',
              left: `${event.qrPlacementX || 50}%`,
              top: `${event.qrPlacementY || 70}%`,
              transform: `translate(-50%, -50%) rotate(${event.qrRotation || 0}deg)`,
              width: Math.min(event.qrSize || 120, 200),
              height: Math.min(event.qrSize || 120, 200),
            }}
          />
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
    console.error('OG Card generation error:', error);
    return new Response('Error generating card: ' + error.message, { status: 500 });
  }
}