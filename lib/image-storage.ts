// lib/image-storage.ts
import { put } from '@vercel/blob';
import { prisma } from './prisma';
import { generateQRFromCardNumber } from './qr';
import sharp from 'sharp';

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

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Map Google Font names to system fonts available on Vercel
 */
function getSystemFont(fontFamily: string): string {
  const fontMap: Record<string, string> = {
    'Playfair Display': 'Georgia',
    'DM Sans': 'Arial',
    'Roboto': 'Arial',
    'Lora': 'Georgia',
    'Montserrat': 'Arial',
    'Open Sans': 'Arial',
    'Raleway': 'Arial',
    'Nunito': 'Arial',
    'Poppins': 'Arial',
    'Great Vibes': 'Georgia',
    'Parisienne': 'Georgia',
    'Alex Brush': 'Georgia',
    'Tangerine': 'Georgia',
    'Dancing Script': 'Georgia',
    'Pacifico': 'Georgia',
    'Satisfy': 'Georgia',
    'Cedarville Cursive': 'Georgia',
    'Kaushan Script': 'Georgia',
    'Georgia': 'Georgia',
    'monospace': 'monospace',
    'Arial': 'Arial',
  };
  return fontMap[fontFamily] || 'Georgia';
}

/**
 * Apply overlay to the card
 */
async function applyOverlay(
  cardBuffer: Buffer,
  overlayColor: string,
  overlayOpacity: number
): Promise<Buffer> {
  if (!overlayColor || !overlayOpacity || overlayOpacity <= 0) {
    return cardBuffer;
  }

  const overlayBuffer = await sharp({
    create: {
      width: 800,
      height: 1200,
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

/**
 * Render text as SVG with system fonts
 */
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

  const systemFont = getSystemFont(fontFamily);
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
    font-family="${systemFont}, serif"
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
  // ─── 1. Apply overlay ──────────────────────────────────────────────────
  let processedBuffer = cardBuffer;
  
  if (event.overlayColor && event.overlayOpacity && event.overlayOpacity > 0) {
    processedBuffer = await applyOverlay(
      processedBuffer,
      event.overlayColor,
      event.overlayOpacity
    );
  }

  // ─── 2. Parse design layers ────────────────────────────────────────────
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

  // ─── 3. Get image dimensions ───────────────────────────────────────────
  const image = sharp(processedBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 1200;

  // ─── 4. Add text layers using pure SVG ──────────────────────────────
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

      const x = ((layer.x || 50) / 100) * width;
      const y = ((layer.y || 50) / 100) * height;
      
      try {
        const textImage = await renderTextSvg(text, {
          fontSize: layer.fontSize || 24,
          fontFamily: layer.fontFamily || 'Playfair Display',
          color: layer.color || '#ffffff',
          align: layer.align || 'center',
          width: width,
          height: height,
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

  // ─── 5. Add QR code ──────────────────────────────────────────────────
  const qrPosition = {
    x: event.qrPlacementX ?? 85,
    y: event.qrPlacementY ?? 85,
    size: event.qrSize ?? 150,
  };

  const qrColor = event.qrColor || '#000000';
  const qrRotation = event.qrRotation || 0;
  const cardNumber = guest.cardNumber || '00000';
  const qrBuffer = await generateQRFromCardNumber(cardNumber, qrPosition.size, qrColor);

  const qrX = ((qrPosition.x) / 100) * width - qrPosition.size / 2;
  const qrY = ((qrPosition.y) / 100) * height - qrPosition.size / 2;

  let finalBuffer = processedBuffer;
  
  try {
    if (qrRotation !== 0) {
      const rotatedQr = await sharp(qrBuffer)
        .rotate(qrRotation)
        .png()
        .toBuffer();
      
      finalBuffer = await sharp(processedBuffer)
        .composite([
          {
            input: rotatedQr,
            top: Math.round(qrY),
            left: Math.round(qrX),
          },
        ])
        .png()
        .toBuffer();
    } else {
      finalBuffer = await sharp(processedBuffer)
        .composite([
          {
            input: qrBuffer,
            top: Math.round(qrY),
            left: Math.round(qrX),
          },
        ])
        .png()
        .toBuffer();
    }
  } catch (qrError) {
    console.error('Failed to composite QR code:', qrError);
  }

  // ─── 6. Add card number if not already in layers ────────────────────
  const hasCardNumberLayer = designLayers.some(l => l.isCardNumber);
  if (guest.cardNumber && !hasCardNumberLayer) {
    try {
      const cardNumberImage = await renderTextSvg(
        `#${guest.cardNumber}`,
        {
          fontSize: 16,
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.7)',
          align: 'right',
          width: width,
          height: height,
          x: width - 30,
          y: height - 30,
          rotation: 0,
          shadow: false,
        }
      );
      
      finalBuffer = await sharp(finalBuffer)
        .composite([
          {
            input: cardNumberImage,
            top: 0,
            left: 0,
          },
        ])
        .png()
        .toBuffer();
    } catch (cardNumberError) {
      console.error('Failed to add card number:', cardNumberError);
    }
  }

  // ─── 7. Add guest type badge if DOUBLE ─────────────────────────────
  const hasGuestTypeLayer = designLayers.some(l => l.isGuestType);
  if (guest.guestType === 'DOUBLE' && !hasGuestTypeLayer) {
    try {
      const guestTypeImage = await renderTextSvg(
        '+1 Guest',
        {
          fontSize: 11,
          fontFamily: 'Arial',
          color: 'rgba(255,255,255,0.6)',
          align: 'center',
          width: width,
          height: height,
          x: width - 70,
          y: height - 53,
          rotation: 0,
          shadow: false,
        }
      );
      
      finalBuffer = await sharp(finalBuffer)
        .composite([
          {
            input: guestTypeImage,
            top: 0,
            left: 0,
          },
        ])
        .png()
        .toBuffer();
    } catch (guestTypeError) {
      console.error('Failed to add guest type badge:', guestTypeError);
    }
  }

  // ─── 8. Upload to Vercel Blob ──────────────────────────────────────
  const blob = await put(`guests/${event.tenantId}/${guest.id}.png`, finalBuffer, {
    access: 'public',
    contentType: 'image/png',
    allowOverwrite: true,
  });

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