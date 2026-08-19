// app/api/og/card/route.tsx
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const mode = searchParams.get('mode') || 'full';
    
    if (!code) {
      return new Response('Missing code parameter', { status: 400 });
    }

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

    // ─── Generate QR code ──────────────────────────────────────────────────
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

    // ─── Create the card image using Sharp ──────────────────────────────
    const width = mode === 'qr-only' ? 400 : 800;
    const height = mode === 'qr-only' ? 400 : 1200;
    const qrSize = mode === 'qr-only' ? 300 : 120;

    // ─── Build SVG for the card ──────────────────────────────────────────
    const overlayColor = event.overlayColor || '#000000';
    const overlayOpacity = event.overlayOpacity || 0.2;

    let svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
        <defs>
          <style>
            .title { font-family: 'Georgia', serif; font-weight: bold; fill: #ffffff; text-anchor: middle; }
            .subtitle { font-family: 'Georgia', serif; fill: #ffffff; text-anchor: middle; }
            .text { font-family: 'Arial', sans-serif; fill: #ffffff; text-anchor: middle; }
          </style>
        </defs>
        <!-- Background -->
        <rect width="${width}" height="${height}" fill="#0D4F4F"/>
    `;

    // ─── Add template image if available ──────────────────────────────────
    if (event.templateCardUrl) {
      svg += `<image href="${event.templateCardUrl}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>`;
    }

    // ─── Add overlay ──────────────────────────────────────────────────────
    if (overlayOpacity > 0) {
      svg += `<rect width="${width}" height="${height}" fill="${overlayColor}" opacity="${overlayOpacity}"/>`;
    }

    // ─── Add content ──────────────────────────────────────────────────────
    if (mode !== 'qr-only') {
      svg += `
        <!-- Title -->
        <text x="${width/2}" y="${height * 0.15}" class="title" font-size="48" filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.3))">
          You're Invited!
        </text>

        <!-- Guest Name -->
        <text x="${width/2}" y="${height * 0.28}" class="subtitle" font-size="28" filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.3))">
          ${guestName}
        </text>

        <!-- Event Name -->
        <text x="${width/2}" y="${height * 0.38}" class="text" font-size="20" filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.3))">
          ${event.name}
        </text>

        <!-- Date -->
        <text x="${width/2}" y="${height * 0.46}" class="text" font-size="16" filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.3))">
          ${eventDate}
        </text>

        <!-- Venue -->
        <text x="${width/2}" y="${height * 0.54}" class="text" font-size="16" filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.3))">
          ${event.venue}
        </text>

        <!-- Card Info -->
        <text x="${width/2}" y="${height * 0.62}" class="text" font-size="14" filter="drop-shadow(2px 2px 4px rgba(0,0,0,0.3))">
          Card No: ${guest.cardNumber} • ${guest.guestType || 'SINGLE'}
        </text>
      `;
    }

    // ─── Add QR code ──────────────────────────────────────────────────────
    const qrBase64 = qrBuffer.toString('base64');
    svg += `
        <!-- QR Code -->
        <image href="data:image/png;base64,${qrBase64}" 
               x="${(width - qrSize) / 2}" 
               y="${mode === 'qr-only' ? 50 : height * 0.7}" 
               width="${qrSize}" 
               height="${qrSize}"/>
    `;

    if (mode === 'qr-only') {
      svg += `
        <text x="${width/2}" y="${height - 40}" class="text" font-size="18" fill="#333333" font-weight="bold">
          Show this QR code at the entrance
        </text>
        <text x="${width/2}" y="${height - 15}" class="text" font-size="12" fill="#999999">
          ${guestName} • ${guest.cardNumber}
        </text>
      `;
    } else {
      svg += `
        <text x="${width/2}" y="${height * 0.85}" class="text" font-size="12" fill="rgba(255,255,255,0.8)">
          Scan to check in
        </text>
      `;
    }

    svg += `</svg>`;

    // ─── Convert SVG to PNG using Sharp ──────────────────────────────────
    const pngBuffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    // ─── Return the PNG image using Response with Uint8Array ────────────
    // Convert Buffer to Uint8Array to avoid type issues
    const uint8Array = new Uint8Array(pngBuffer);

    return new Response(uint8Array, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });

  } catch (error: any) {
    console.error('OG Card generation error:', error);
    return new Response('Error generating card: ' + error.message, { status: 500 });
  }
}