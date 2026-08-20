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
 * Get Google Font URL for a given font family
 */
function getGoogleFontUrl(fontFamily: string): string {
  const fontMap: Record<string, string> = {
    'Playfair Display': 'Playfair+Display:wght@400;700',
    'DM Sans': 'DM+Sans:wght@400;700',
    'Roboto': 'Roboto:wght@400;700',
    'Lora': 'Lora:wght@400;700',
    'Montserrat': 'Montserrat:wght@400;700',
    'Georgia': 'Georgia',
    'Open Sans': 'Open+Sans:wght@400;700',
    'Raleway': 'Raleway:wght@400;700',
    'Nunito': 'Nunito:wght@400;700',
    'Poppins': 'Poppins:wght@400;700',
    'Great Vibes': 'Great+Vibes',
    'Parisienne': 'Parisienne',
    'Alex Brush': 'Alex+Brush',
    'Tangerine': 'Tangerine',
    'Dancing Script': 'Dancing+Script:wght@400;700',
    'Pacifico': 'Pacifico',
    'Satisfy': 'Satisfy',
    'Cedarville Cursive': 'Cedarville+Cursive',
    'Kaushan Script': 'Kaushan+Script',
  };
  
  const fontName = fontMap[fontFamily];
  if (!fontName) return '';
  
  return `https://fonts.googleapis.com/css2?family=${fontName}&display=swap`;
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

  const image = sharp(cardBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 1200;

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

/**
 * Add text layers to the card using SVG overlay with Google Fonts
 */
async function addTextLayersToCard(
  cardBuffer: Buffer,
  layers: any[],
  guest: any,
  event: any
): Promise<Buffer> {
  if (!layers || layers.length === 0) {
    return cardBuffer;
  }

  const image = sharp(cardBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 1200;

  // Collect all unique fonts used in layers
  const usedFonts = new Set<string>();
  for (const layer of layers) {
    if (layer.type === 'text' && layer.fontFamily) {
      usedFonts.add(layer.fontFamily);
    }
  }

  // Build font imports
  let fontImports = '';
  for (const font of usedFonts) {
    const fontUrl = getGoogleFontUrl(font);
    if (fontUrl) {
      fontImports += `@import url('${fontUrl}');\n`;
    }
  }

  // Build SVG with all text layers
  let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
  
  // Add font imports and styles
  svgContent += `<style>
    ${fontImports}
    .text-layer { 
      font-weight: bold;
      text-shadow: 2px 2px 8px rgba(0,0,0,0.5);
    }
  </style>`;

  const guestName = getGuestFullName(guest);
  const eventDate = event.date ? new Date(event.date).toLocaleDateString('sw-TZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }) : '';

  for (const layer of layers) {
    if (!layer || layer.visible === false) continue;
    
    if (layer.type === 'text') {
      let text = layer.text || '';
      
      // ─── Replace placeholders ────────────────────────────────────
      if (layer.isGuestName) {
        text = guestName;
      } else if (layer.isGuestType) {
        text = guest.guestType === 'DOUBLE' ? 'Double' : 'Single';
      } else if (layer.isCardNumber) {
        text = guest.cardNumber || '';
      } else {
        text = String(text)
          .replace(/{guestName}/g, guestName)
          .replace(/{guestTitle}/g, guest.title || '')
          .replace(/{cardNumber}/g, guest.cardNumber || '')
          .replace(/{eventName}/g, event.name || '')
          .replace(/{eventDate}/g, eventDate)
          .replace(/{venue}/g, event.venue || '')
          .replace(/{guestType}/g, guest.guestType === 'DOUBLE' ? 'Double' : 'Single');
      }

      // Skip empty text
      if (!text || text.trim() === '') continue;

      const x = ((layer.x || 50) / 100) * width;
      const y = ((layer.y || 50) / 100) * height;
      const fontSize = layer.fontSize || 24;
      const fontFamily = layer.fontFamily || 'Playfair Display';
      const color = layer.color || '#ffffff';
      const rotation = layer.rotation || 0;
      const align = layer.align || 'center';
      
      const textAnchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
      const anchorX = align === 'left' ? x : align === 'right' ? x : x;
      
      // Use the actual font family name
      svgContent += `
        <text
          x="${anchorX}"
          y="${y}"
          font-family="${fontFamily}, Georgia, serif"
          font-size="${fontSize}"
          fill="${color}"
          text-anchor="${textAnchor}"
          dominant-baseline="middle"
          transform="rotate(${rotation}, ${anchorX}, ${y})"
          class="text-layer"
        >${escapeXml(text)}</text>
      `;
    }
  }

  svgContent += '</svg>';

  const svgBuffer = Buffer.from(svgContent);
  
  return await sharp(cardBuffer)
    .composite([
      {
        input: svgBuffer,
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
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

  // ─── 3. Add design layers (text) ─────────────────────────────────────
  if (designLayers.length > 0) {
    const textLayers = designLayers.filter(l => l.type === 'text');
    if (textLayers.length > 0) {
      processedBuffer = await addTextLayersToCard(
        processedBuffer,
        textLayers,
        guest,
        event
      );
    }
  }

  // ─── 4. Add QR code ──────────────────────────────────────────────────
  const qrPosition = {
    x: event.qrPlacementX ?? 85,
    y: event.qrPlacementY ?? 85,
    size: event.qrSize ?? 150,
  };

  const qrColor = event.qrColor || '#000000';
  const qrRotation = event.qrRotation || 0;

  const cardNumber = guest.cardNumber || '00000';
  const qrBuffer = await generateQRFromCardNumber(cardNumber, qrPosition.size, qrColor);

  // ─── 5. Composite QR onto card ──────────────────────────────────────
  const image = sharp(processedBuffer);
  const metadata = await image.metadata();
  const width = metadata.width || 800;
  const height = metadata.height || 1200;

  const qrX = ((qrPosition.x) / 100) * width - qrPosition.size / 2;
  const qrY = ((qrPosition.y) / 100) * height - qrPosition.size / 2;

  let finalBuffer = processedBuffer;
  
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

  // ─── 6. Add card number if not already in layers ────────────────────
  const hasCardNumberLayer = designLayers.some(l => l.isCardNumber);
  if (guest.cardNumber && !hasCardNumberLayer) {
    const cardNumberSvg = `
      <svg width="${width}" height="${height}">
        <text
          x="${width - 30}"
          y="${height - 30}"
          font-family="monospace"
          font-size="16"
          fill="rgba(255,255,255,0.7)"
          text-anchor="end"
          dominant-baseline="middle"
        >#${escapeXml(guest.cardNumber)}</text>
      </svg>
    `;
    
    finalBuffer = await sharp(finalBuffer)
      .composite([
        {
          input: Buffer.from(cardNumberSvg),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();
  }

  // ─── 7. Add guest type badge if DOUBLE ─────────────────────────────
  const hasGuestTypeLayer = designLayers.some(l => l.isGuestType);
  if (guest.guestType === 'DOUBLE' && !hasGuestTypeLayer) {
    const guestTypeSvg = `
      <svg width="${width}" height="${height}">
        <rect
          x="${width - 110}"
          y="${height - 65}"
          width="80"
          height="24"
          rx="12"
          fill="rgba(0,0,0,0.3)"
        />
        <text
          x="${width - 70}"
          y="${height - 53}"
          font-family="Arial, sans-serif"
          font-size="11"
          fill="rgba(255,255,255,0.6)"
          text-anchor="middle"
          dominant-baseline="middle"
        >+1 Guest</text>
      </svg>
    `;
    
    finalBuffer = await sharp(finalBuffer)
      .composite([
        {
          input: Buffer.from(guestTypeSvg),
          top: 0,
          left: 0,
        },
      ])
      .png()
      .toBuffer();
  }

  // ─── 8. Upload to Vercel Blob ──────────────────────────────────────
  const blob = await put(`guests/${event.tenantId}/${guest.id}.png`, finalBuffer, {
    access: 'public',
    contentType: 'image/png',
    allowOverwrite: true,
  });

  return blob.url;
}

// Runs `fn` over `items` with at most `limit` in flight at once —
// keeps Neon connections and Blob uploads from spiking all at once.
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

// ─── Legacy function for backward compatibility ─────────────────────────
export async function generateAndStoreCardImage(guestId: string): Promise<string> {
  return generateAndStoreCardForGuest(guestId);
}

export function getCardImageUrl(passCode: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://littlewed.co.tz';
  return `${baseUrl}/api/og/card?code=${passCode}`;
}