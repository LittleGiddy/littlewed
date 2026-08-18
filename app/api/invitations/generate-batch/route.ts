// app/api/invitations/generate-batch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import sharp from 'sharp';
import QRCode from 'qrcode';

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

    // ─── Fetch event with all settings ──────────────────────────────────
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

    // ─── Get design settings from event ──────────────────────────────────
    const templateUrl = event.templateCardUrl;
    const overlayColor = event.overlayColor || '#000000';
    const overlayOpacity = event.overlayOpacity || 0.2;
    const qrX = event.qrPlacementX || 100;
    const qrY = event.qrPlacementY || 100;
    const qrSize = event.qrSize || 200;
    const qrColor = event.qrColor || '#000000';
    const qrRotation = event.qrRotation || 0;
    const designLayers = event.designLayers as any[] || [];

    if (!templateUrl) {
      return NextResponse.json({ 
        error: 'No template selected. Please design a card first.' 
      }, { status: 400 });
    }

    const results = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < guests.length; i += BATCH_SIZE) {
      const batch = guests.slice(i, i + BATCH_SIZE);
      
      for (const guest of batch) {
        try {
          // ─── Generate personalized card ──────────────────────────────
          const cardUrl = await generatePersonalizedCard({
            templateUrl,
            guest,
            event,
            designLayers,
            overlayColor,
            overlayOpacity,
            qrX,
            qrY,
            qrSize,
            qrColor,
            qrRotation,
          });

          // ─── Update guest with card URL ──────────────────────────────
          await prisma.guest.update({
            where: { id: guest.id },
            data: { invitationCard: cardUrl },
          });

          results.push({
            guestId: guest.id,
            name: guest.name,
            success: true,
            cardUrl,
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

      // Small delay between batches
      if (i + BATCH_SIZE < guests.length) {
        await new Promise(r => setTimeout(r, 500));
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

// ─── Generate personalized card using Sharp ────────────────────────────
async function generatePersonalizedCard({
  templateUrl,
  guest,
  event,
  designLayers,
  overlayColor,
  overlayOpacity,
  qrX,
  qrY,
  qrSize,
  qrColor,
  qrRotation,
}: {
  templateUrl: string;
  guest: any;
  event: any;
  designLayers: any[];
  overlayColor: string;
  overlayOpacity: number;
  qrX: number;
  qrY: number;
  qrSize: number;
  qrColor: string;
  qrRotation: number;
}): Promise<string> {
  // ─── Fetch template image ──────────────────────────────────────────────
  const response = await fetch(templateUrl);
  const templateBuffer = await response.arrayBuffer();
  
  let image = sharp(Buffer.from(templateBuffer));
  const metadata = await image.metadata();
  
  const width = metadata.width || 800;
  const height = metadata.height || 1200;

  // ─── Create composited image ──────────────────────────────────────────
  const layers: sharp.OverlayOptions[] = [
    // Template layer
    {
      input: Buffer.from(templateBuffer),
      top: 0,
      left: 0,
    },
  ];

  // ─── Add overlay ──────────────────────────────────────────────────────
  if (overlayOpacity > 0) {
    const overlayBuffer = Buffer.from(
      `<svg width="${width}" height="${height}">
        <rect width="${width}" height="${height}" fill="${overlayColor}" opacity="${overlayOpacity}" />
      </svg>`
    );
    layers.push({
      input: overlayBuffer,
      top: 0,
      left: 0,
    });
  }

  // ─── Process design layers ────────────────────────────────────────────
  const guestName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
  const eventDate = event.date ? new Date(event.date).toLocaleDateString('sw-TZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }) : '';

  for (const layer of designLayers) {
    if (!layer.visible) continue;

    const x = (layer.x / 100) * width;
    const y = (layer.y / 100) * height;

    if (layer.type === 'text') {
      let text = layer.text;
      
      // ─── Replace placeholders ──────────────────────────────────────
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
      
      // ─── Create text SVG ──────────────────────────────────────────────
      const lines = text.split('\n');
      const lineHeight = fontSize * 1.4;
      
      let textSvg = `<text x="${x}" y="${y}" font-family="${fontFamily}" font-size="${fontSize}" font-weight="bold" fill="${color}" text-anchor="${layer.align || 'center'}" dominant-baseline="middle" transform="rotate(${layer.rotation || 0}, ${x}, ${y})">`;
      
      for (let i = 0; i < lines.length; i++) {
        const dy = i === 0 ? 0 : lineHeight;
        textSvg += `<tspan x="${x}" dy="${dy}">${lines[i]}</tspan>`;
      }
      textSvg += '</text>';

      // ─── Add shadow if needed ──────────────────────────────────────
      let fullSvg = '';
      if (layer.shadow) {
        const blur = layer.shadow.blur || 4;
        const offsetX = layer.shadow.offsetX || 0;
        const offsetY = layer.shadow.offsetY || 2;
        const shadowColor = layer.shadow.color || 'rgba(0,0,0,0.3)';
        fullSvg = `
          <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="${offsetX}" dy="${offsetY}" stdDeviation="${blur}" flood-color="${shadowColor}" />
              </filter>
            </defs>
            <g filter="url(#shadow)">
              ${textSvg}
            </g>
          </svg>
        `;
      } else {
        fullSvg = `
          <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            ${textSvg}
          </svg>
        `;
      }

      const textBuffer = Buffer.from(fullSvg);
      layers.push({
        input: textBuffer,
        top: 0,
        left: 0,
      });
    }

    if (layer.type === 'rect') {
      const rectWidth = (layer.width / 100) * width;
      const rectHeight = (layer.height / 100) * height;
      
      let rectSvg = `<rect x="${x - rectWidth/2}" y="${y - rectHeight/2}" width="${rectWidth}" height="${rectHeight}" fill="${layer.fill || 'rgba(255,255,255,0.2)'}" transform="rotate(${layer.rotation || 0}, ${x}, ${y})" />`;
      
      if (layer.borderWidth > 0 && layer.borderColor) {
        rectSvg += `<rect x="${x - rectWidth/2}" y="${y - rectHeight/2}" width="${rectWidth}" height="${rectHeight}" fill="none" stroke="${layer.borderColor}" stroke-width="${layer.borderWidth}" transform="rotate(${layer.rotation || 0}, ${x}, ${y})" />`;
      }
      
      const rectBuffer = Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          ${rectSvg}
        </svg>`
      );
      
      layers.push({
        input: rectBuffer,
        top: 0,
        left: 0,
      });
    }

    if (layer.type === 'line') {
      const startX = (layer.startX / 100) * width;
      const startY = (layer.startY / 100) * height;
      const endX = (layer.endX / 100) * width;
      const endY = (layer.endY / 100) * height;
      
      let dashArray = '';
      if (layer.dashArray === 'dashed') dashArray = ' stroke-dasharray="5,5"';
      else if (layer.dashArray === 'dotted') dashArray = ' stroke-dasharray="2,4"';
      
      const lineSvg = `<line x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}" stroke="${layer.strokeColor || '#ffffff'}" stroke-width="${layer.strokeWidth || 2}"${dashArray} transform="rotate(${layer.rotation || 0}, ${(startX + endX)/2}, ${(startY + endY)/2})" />`;
      
      const lineBuffer = Buffer.from(
        `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          ${lineSvg}
        </svg>`
      );
      
      layers.push({
        input: lineBuffer,
        top: 0,
        left: 0,
      });
    }
  }

  // ─── Generate QR Code ──────────────────────────────────────────────────
  const qrCodeDataUrl = await generateQRCode({
    guestId: guest.id,
    eventId: event.id,
    cardNumber: guest.cardNumber,
    qrSize,
    qrColor,
  });

  if (qrCodeDataUrl) {
    const qrBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64');
    const qrWidth = Math.min(qrSize, 300);
    const qrHeight = Math.min(qrSize, 300);
    const qrXPos = (qrX / 100) * width - qrWidth / 2;
    const qrYPos = (qrY / 100) * height - qrHeight / 2;
    
    layers.push({
      input: qrBuffer,
      top: qrYPos,
      left: qrXPos,
    });
  }

  // ─── Composite all layers ──────────────────────────────────────────────
  const compositeBuffer = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
  .composite(layers)
  .png()
  .toBuffer();

  // ─── Return base64 for testing ─────────────────────────────────────────
  return `data:image/png;base64,${compositeBuffer.toString('base64')}`;
}

// ─── Generate QR Code ──────────────────────────────────────────────────
async function generateQRCode({
  guestId,
  eventId,
  cardNumber,
  qrSize,
  qrColor,
}: {
  guestId: string;
  eventId: string;
  cardNumber?: string | null;
  qrSize: number;
  qrColor: string;
}): Promise<string | null> {
  try {
    const data = JSON.stringify({
      guestId,
      eventId,
      cardNumber: cardNumber || 'unknown',
      checkInUrl: `https://littlewed.co.tz/check-in?guest=${guestId}&event=${eventId}`,
    });

    const qrOptions = {
      width: Math.min(qrSize * 2, 400),
      color: {
        dark: qrColor || '#000000',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H' as QRCode.QRCodeErrorCorrectionLevel,
    };

    const qrDataUrl = await QRCode.toDataURL(data, qrOptions);
    return qrDataUrl;
  } catch (error) {
    console.error('QR Code generation error:', error);
    return null;
  }
}