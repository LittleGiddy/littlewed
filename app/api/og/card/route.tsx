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
      console.error('[OG Card] Missing guestId or code parameter');
      return new Response('Missing guestId or code parameter', { status: 400 });
    }

    if (!guest) {
      console.error('[OG Card] Guest not found for:', { guestId, code });
      return new Response('Guest not found', { status: 404 });
    }

    console.log('[OG Card] Generating for guest:', guest.id, guest.name);

    const event = guest.event;
    
    if (!event.templateCardUrl) {
      console.error('[OG Card] No template for event:', event.id);
      return new Response('No invitation card template configured', { status: 400 });
    }

    const guestName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
    
    // ─── Safely parse date ──────────────────────────────────────────────
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

    // ─── Generate QR code for check-in ──────────────────────────────────
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
      console.error('[OG Card] QR generation error:', qrError);
      // Continue without QR code
    }

    // ─── Get design settings from event ──────────────────────────────────
    const templateUrl = event.templateCardUrl;
    const overlayColor = event.overlayColor || '#000000';
    const overlayOpacity = event.overlayOpacity || 0.2;
    
    // ✅ SAFELY PARSE design layers
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
      console.warn('[OG Card] Failed to parse design layers:', e);
      // Use empty array if parsing fails
    }

    // ─── Also get the QR position from event ────────────────────────────
    const qrPosition = {
      x: event.qrPlacementX ?? 50,
      y: event.qrPlacementY ?? 70,
      size: Math.min(event.qrSize ?? 120, 200),
    };

    // ─── Render the invitation card ────────────────────────────────────
    try {
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
            {Array.isArray(designLayers) && designLayers.map((layer: any, index: number) => {
              if (!layer || layer.visible === false) return null;
              
              try {
                const x = ((layer.x || 50) / 100) * 800;
                const y = ((layer.y || 50) / 100) * 1200;

                if (layer.type === 'text') {
                  let text = layer.text || '';
                  
                  // ─── Replace placeholders with actual guest data ────────────
                  if (layer.isGuestName) {
                    text = guestName;
                  } else if (layer.isGuestType) {
                    text = guest.title || guest.guestType || '';
                  } else if (layer.isCardNumber) {
                    text = guest.cardNumber || '';
                  } else {
                    text = String(text)
                      .replace(/{guestName}/g, guestName)
                      .replace(/{guestTitle}/g, guest.title || '')
                      .replace(/{cardNumber}/g, guest.cardNumber || '')
                      .replace(/{eventName}/g, event.name || '')
                      .replace(/{eventDate}/g, eventDate)
                      .replace(/{venue}/g, event.venue || '');
                  }

                  const fontSize = layer.fontSize || 24;
                  const fontFamily = layer.fontFamily || 'Playfair Display, serif';
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
                        textAlign: (layer.align || 'center') as any,
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
                  const width = ((layer.width || 30) / 100) * 800;
                  const height = ((layer.height || 20) / 100) * 1200;
                  
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
              } catch (layerError) {
                console.error('[OG Card] Error rendering layer:', layerError);
                return null;
              }
            })}

            {/* ─── QR Code ─── */}
            {qrBase64 && (
              <img
                src={`data:image/png;base64,${qrBase64}`}
                style={{
                  position: 'absolute',
                  left: `${qrPosition.x}%`,
                  top: `${qrPosition.y}%`,
                  transform: `translate(-50%, -50%) rotate(${event.qrRotation || 0}deg)`,
                  width: qrPosition.size,
                  height: qrPosition.size,
                }}
              />
            )}
          </div>
        ),
        {
          width: 800,
          height: 1200,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    } catch (imageError) {
      console.error('[OG Card] ImageResponse error:', imageError);
      return new Response(`Image generation error: ${imageError instanceof Error ? imageError.message : 'Unknown error'}`, { status: 500 });
    }

  } catch (error: any) {
    console.error('[OG Card] Fatal error:', error);
    return new Response(`Fatal error: ${error.message || 'Unknown error'}`, { status: 500 });
  }
}