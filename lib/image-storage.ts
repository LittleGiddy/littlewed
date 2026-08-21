// lib/image-storage.ts
import './fonts';
import { put } from '@vercel/blob';
import { prisma } from './prisma';
import { generateQRFromCardNumber } from './qr';
import sharp from 'sharp';

// ─── Constants ──────────────────────────────────────────────────────────
// These MUST match DESIGNER_WIDTH / DESIGNER_HEIGHT in the designer page.
const DESIGNER_WIDTH = 800;
const DESIGNER_HEIGHT = 1200;

// ─── Type definitions ─────────────────────────────────────────────────────
interface EventLike {
  tenantId: string;
  templateCardUrl: string | null;
  qrPlacementX: number | null;
  qrPlacementY: number | null;
  qrSize: number | null;
  qrRotation: number | null;
  qrColor: string | null;
  includeName: boolean | null;
  namePlacementX: number | null;
  namePlacementY: number | null;
  nameFontSize: number | null;
  nameFontColor: string | null;
  nameFontFamily: string | null;
  overlayColor: string | null;
  overlayOpacity: number | null;
  designLayers: any;
  name?: string | null;
  venue?: string | null;
  date?: string | Date | null;
}

function getGuestFullName(guest: any): string {
  return guest.title ? `${guest.title} ${guest.name}` : guest.name;
}

export async function fetchTemplateBuffer(templateCardUrl: string): Promise<Buffer> {
  const response = await fetch(templateCardUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch template card: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Font family resolution ────────────────────────────────────────────
// Passes the real font family through to fontconfig (registered via
// lib/fonts.ts from public/fonts) instead of substituting a system font.
// A generic CSS fallback is appended so rendering degrades gracefully
// (rather than showing tofu boxes) if a specific font file is ever missing.
const SCRIPT_FONTS = new Set([
  'Great Vibes', 'Parisienne', 'Alex Brush', 'Tangerine',
  'Dancing Script', 'Pacifico', 'Satisfy', 'Cedarville Cursive', 'Kaushan Script',
]);

function svgFontFamily(fontFamily: string): string {
  const family = fontFamily || 'Playfair Display';
  const fallback = SCRIPT_FONTS.has(family) ? 'cursive' : 'serif';
  // Quote the family name in case it contains spaces.
  return `"${family}", ${fallback}`;
}

async function applyOverlay(
  cardBuffer: Buffer,
  overlayColor: string,
  overlayOpacity: number
): Promise<Buffer> {
  if (!overlayColor || !overlayOpacity || overlayOpacity <= 0) {
    return cardBuffer;
  }

  const metadata = await sharp(cardBuffer).metadata();
  const width = metadata.width || 3508;
  const height = metadata.height || 4961;

  const overlayBuffer = await sharp({
    create: {
      width: width,
      height: height,
      channels: 4,
      background: overlayColor,
    },
  })
    .png()
    .toBuffer();

  return await sharp(cardBuffer)
    .composite([
      {
        input: overlayBuffer,
        top: 0,
        left: 0,
        blend: 'overlay',
      },
    ])
    .png()
    .toBuffer();
}

async function renderTextSvg(
  text: string,
  options: {
    fontSize: number;
    fontFamily: string;
    color: string;
    align: 'left' | 'center' | 'right';
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
    shadow?: boolean;
  }
): Promise<Buffer> {
  const { 
    fontSize, fontFamily, color, align, width, height, x, y, rotation, shadow = true 
  } = options;

  const resolvedFontFamily = svgFontFamily(fontFamily);
  const textAnchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const anchorX = align === 'left' ? 0 : align === 'right' ? width : width / 2;
  
  const shadowStyle = shadow ? `
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.5"/>
    </filter>
  ` : '';

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${shadowStyle}
  </defs>
  <text
    x="${anchorX}"
    y="${y}"
    font-family="${resolvedFontFamily}"
    font-size="${fontSize}"
    fill="${color}"
    text-anchor="${textAnchor}"
    dominant-baseline="middle"
    transform="rotate(${rotation}, ${anchorX}, ${y})"
    ${shadow ? 'filter="url(#shadow)"' : ''}
    style="font-weight: bold;"
  >${escapeXml(text)}</text>
</svg>`;

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

export async function generateCardForGuest(
  guest: any,
  event: EventLike,
  cardBuffer: Buffer
): Promise<string> {
  // ─── 1. Get actual image dimensions ──────────────────────────────────
  const metadata = await sharp(cardBuffer).metadata();
  const actualWidth = metadata.width || 3508;
  const actualHeight = metadata.height || 4961;

  // ─── 2. Calculate scale factor ──────────────────────────────────────
  const scaleX = actualWidth / DESIGNER_WIDTH;
  const scaleY = actualHeight / DESIGNER_HEIGHT;
  const scaleFactor = Math.min(scaleX, scaleY);

  console.log('[CardGen] Scaling:', {
    designerSize: `${DESIGNER_WIDTH}x${DESIGNER_HEIGHT}`,
    actualSize: `${actualWidth}x${actualHeight}`,
    scaleFactor: scaleFactor.toFixed(2)
  });

  // ─── 3. Apply overlay ──────────────────────────────────────────────────
  let processedBuffer = cardBuffer;
  
  if (event.overlayColor && event.overlayOpacity && event.overlayOpacity > 0) {
    processedBuffer = await applyOverlay(
      processedBuffer,
      event.overlayColor,
      event.overlayOpacity
    );
  }

  // ─── 4. Parse design layers ────────────────────────────────────────────
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
    console.warn('Failed to parse designLayers:', e);
    designLayers = [];
  }

  console.log('[CardGen] Design layers count:', designLayers.length);

  // ─── 5. Add ALL text layers from design ──────────────────────────────
  const textComposites: sharp.OverlayOptions[] = [];
  
  if (designLayers.length > 0) {
    const textLayers = designLayers.filter(l => l.type === 'text');
    
    const guestFullName = getGuestFullName(guest);
    const guestTitle = guest?.title || '';
    const cardNumber = guest?.cardNumber || '';
    const guestType = guest?.guestType === 'DOUBLE' ? 'Double' : 'Single';
    const eventName = event?.name || '';
    const eventDate = event?.date ? new Date(event.date).toLocaleDateString('sw-TZ', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }) : '';
    const venue = event?.venue || '';

    for (const layer of textLayers) {
      if (!layer || layer.visible === false) continue;
      
      let text = layer.text || '';
      
      if (layer.isGuestName) {
        text = guestFullName;
      } else if (layer.isGuestType) {
        text = guestType;
      } else if (layer.isCardNumber) {
        text = cardNumber;
      } else {
        text = String(text)
          .replace(/{guestName}/g, guestFullName)
          .replace(/{guestTitle}/g, guestTitle)
          .replace(/{cardNumber}/g, cardNumber)
          .replace(/{eventName}/g, eventName)
          .replace(/{eventDate}/g, eventDate)
          .replace(/{venue}/g, venue)
          .replace(/{guestType}/g, guestType);
      }

      if (!text || text.trim() === '') continue;

      // ✅ Scale position from designer to actual size
      const x = ((layer.x || 50) / 100) * actualWidth;
      const y = ((layer.y || 50) / 100) * actualHeight;
      
      // ✅ Scale font size proportionally
      const fontSize = Math.round((layer.fontSize || 24) * scaleFactor);
      
      console.log('[CardGen] Layer:', {
        text: text.substring(0, 20),
        layerX: layer.x,
        layerY: layer.y,
        convertedX: Math.round(x),
        convertedY: Math.round(y),
        fontSize: fontSize,
        fontFamily: layer.fontFamily
      });
      
      try {
        const textImage = await renderTextSvg(text, {
          fontSize: fontSize,
          fontFamily: layer.fontFamily || 'Playfair Display',
          color: layer.color || '#ffffff',
          align: layer.align || 'center',
          width: actualWidth,
          height: actualHeight,
          x: x,
          y: y,
          rotation: layer.rotation || 0,
          shadow: !!layer.shadow,
        });

        textComposites.push({
          input: textImage,
          top: 0,
          left: 0,
        });
      } catch (layerError) {
        console.error(`Failed to render text layer: ${text}`, layerError);
      }
    }
  }

  if (textComposites.length > 0) {
    processedBuffer = await sharp(processedBuffer)
      .composite(textComposites)
      .png()
      .toBuffer();
  }

  // ─── 6. Add QR code ──────────────────────────────────────────────────
  const qrSize = Math.round((event.qrSize || 150) * scaleFactor);
  const qrX = event.qrPlacementX ?? 85;
  const qrY = event.qrPlacementY ?? 85;
  const qrColor = event.qrColor || '#0D4F4F';
  const qrRotation = event.qrRotation || 0;
  const cardNumber = guest.cardNumber || '00000';
  
  const qrBuffer = await generateQRFromCardNumber(cardNumber, qrSize, qrColor);

  // ✅ Position QR at center of percentage position
  const qrTopLeftX = ((qrX) / 100) * actualWidth - qrSize / 2;
  const qrTopLeftY = ((qrY) / 100) * actualHeight - qrSize / 2;

  const margin = Math.round(20 * scaleFactor);
  const clampedX = Math.max(margin, Math.min(actualWidth - qrSize - margin, qrTopLeftX));
  const clampedY = Math.max(margin, Math.min(actualHeight - qrSize - margin, qrTopLeftY));

  console.log('[CardGen] QR:', {
    designerSize: event.qrSize || 150,
    scaledSize: qrSize,
    qrX: qrX,
    qrY: qrY,
    topLeftX: Math.round(qrTopLeftX),
    topLeftY: Math.round(qrTopLeftY),
    clampedX: Math.round(clampedX),
    clampedY: Math.round(clampedY)
  });

  let finalBuffer = processedBuffer;
  
  try {
    let qrToComposite = qrBuffer;
    if (qrRotation !== 0) {
      qrToComposite = await sharp(qrBuffer)
        .rotate(qrRotation)
        .png()
        .toBuffer();
    }
    
    finalBuffer = await sharp(processedBuffer)
      .composite([
        {
          input: qrToComposite,
          top: Math.round(clampedY),
          left: Math.round(clampedX),
        },
      ])
      .png()
      .toBuffer();
  } catch (qrError) {
    console.error('Failed to composite QR code:', qrError);
  }

  // ─── 7. Upload to Vercel Blob ──────────────────────────────────────
  const blob = await put(`guests/${event.tenantId}/${guest.id}.png`, finalBuffer, {
    access: 'public',
    contentType: 'image/png',
    allowOverwrite: true,
  });

  console.log('[CardGen] ✅ Card generated:', blob.url);
  return blob.url;
}

// ─── Exports ──────────────────────────────────────────────────────────────
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function generateAndStoreCardForGuest(guestId: string): Promise<string> {
  const guest = await prisma.guest.findUnique({
    where: { id: guestId },
    include: { event: true },
  });

  if (!guest) {
    throw new Error('Guest not found');
  }

  const event = guest.event;
  if (!event.templateCardUrl) {
    throw new Error('No invitation card template configured for this event');
  }

  const cardBuffer = await fetchTemplateBuffer(event.templateCardUrl);
  const imageUrl = await generateCardForGuest(guest, event, cardBuffer);

  await prisma.guest.update({
    where: { id: guest.id },
    data: { invitationCard: imageUrl },
  });

  return imageUrl;
}

export async function generateAndStoreCardImage(guestId: string): Promise<string> {
  return generateAndStoreCardForGuest(guestId);
}

export function getCardImageUrl(passCode: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://littlewed.co.tz';
  return `${baseUrl}/api/og/card?code=${passCode}`;
}