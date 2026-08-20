// lib/qr.ts
import QRCode from 'qrcode';
import sharp from 'sharp';

/**
 * Generate a QR code buffer from a card number
 * @param cardNumber - 5-digit card number (e.g., "00001")
 * @param size - Size of the QR code in pixels
 * @param color - QR code color (default: '#000000')
 * @returns Buffer containing the QR code image
 */
export async function generateQRFromCardNumber(
  cardNumber: string,
  size: number = 200,
  color: string = '#000000'
): Promise<Buffer> {
  const cleanCardNumber = cardNumber?.trim() || '00000';

  return await QRCode.toBuffer(cleanCardNumber, {
    width: size,
    margin: 2,
    color: {
      dark: color,
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });
}

// ─── Generate QR code with custom colors ────────────────────────────────

export async function generateQRWithColors(
  cardNumber: string,
  size: number = 200,
  darkColor: string = '#000000',
  lightColor: string = '#FFFFFF'
): Promise<Buffer> {
  const cleanCardNumber = cardNumber?.trim() || '00000';

  return await QRCode.toBuffer(cleanCardNumber, {
    width: size,
    margin: 2,
    color: {
      dark: darkColor,
      light: lightColor,
    },
    errorCorrectionLevel: 'M',
  });
}

// ─── Keep your existing compositeQROnCard function ──────────────────────

export async function compositeQROnCard(
  cardBuffer: Buffer,
  qrBuffer: Buffer,
  qrPosition: { x: number; y: number; size: number },
  namePosition?: {
    x: number;
    y: number;
    fontSize: number;
    fontColor: string;
    fontFamily: string;
  } | null,
  guestName?: string,
  cardNumber?: string
): Promise<Buffer> {
  try {
    const image = sharp(cardBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 600;

    const qrSize = qrPosition.size || 200;
    const qrX = qrPosition.x || (width - qrSize) / 2;
    const qrY = qrPosition.y || (height - qrSize) / 2;

    const compositeOperations: sharp.OverlayOptions[] = [
      {
        input: qrBuffer,
        top: Math.round(qrY),
        left: Math.round(qrX),
      },
    ];

    if (namePosition && guestName) {
      const fontSize = namePosition.fontSize || 24;
      const fontColor = namePosition.fontColor || '#000000';
      const fontFamily = namePosition.fontFamily || 'Playfair Display, serif';
      const escapedName = escapeXml(guestName);

      const svgText = `
        <svg width="${width}" height="${height}">
          <text
            x="${namePosition.x || 50}"
            y="${namePosition.y || 50}"
            font-family="${fontFamily}"
            font-size="${fontSize}"
            fill="${fontColor}"
            text-anchor="middle"
            dominant-baseline="middle"
          >${escapedName}</text>
        </svg>
      `;

      compositeOperations.push({
        input: Buffer.from(svgText),
        top: 0,
        left: 0,
      });
    }

    if (cardNumber) {
      const svgCardNumber = `
        <svg width="${width}" height="${height}">
          <text
            x="${width - 50}"
            y="${height - 30}"
            font-family="monospace"
            font-size="14"
            fill="#666666"
            text-anchor="end"
          >#${escapeXml(cardNumber)}</text>
        </svg>
      `;

      compositeOperations.push({
        input: Buffer.from(svgCardNumber),
        top: 0,
        left: 0,
      });
    }

    const result = await sharp(cardBuffer)
      .composite(compositeOperations)
      .png()
      .toBuffer();

    return result;
  } catch (error) {
    console.error('Error compositing QR on card:', error);
    throw error;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function generateQRBuffer(
  data: string,
  size: number = 200
): Promise<Buffer> {
  const cleanData = data?.trim() || '00000';
  return await generateQRFromCardNumber(cleanData, size);
}

export function generateGuestToken(guestId: string, eventId: string): string {
  return guestId;
}