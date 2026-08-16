// lib/qr.ts
import QRCode from 'qrcode';
import sharp from 'sharp';

// ─── Generate QR code from card number ──────────────────────────────────

/**
 * Generate a QR code buffer from a card number
 * @param cardNumber - 5-digit card number (e.g., "00001")
 * @param size - Size of the QR code in pixels
 * @returns Buffer containing the QR code image
 */
export async function generateQRFromCardNumber(
  cardNumber: string,
  size: number = 200
): Promise<Buffer> {
  // Ensure card number is valid
  const cleanCardNumber = cardNumber?.trim() || '00000';

  return await QRCode.toBuffer(cleanCardNumber, {
    width: size,
    margin: 2,
    color: {
      dark: '#000000',
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

// ─── Composite QR on invitation card ────────────────────────────────────

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
    // Load the card image to get its dimensions
    const image = sharp(cardBuffer);
    const metadata = await image.metadata();
    const width = metadata.width || 800;
    const height = metadata.height || 600;

    // ─── Composite QR code ──────────────────────────────────────────────
    const qrSize = qrPosition.size || 200;

    // Calculate position (default to center if not specified)
    const qrX = qrPosition.x || (width - qrSize) / 2;
    const qrY = qrPosition.y || (height - qrSize) / 2;

    // Composite the QR code onto the card
    const compositeOperations: sharp.OverlayOptions[] = [
      {
        input: qrBuffer,
        top: Math.round(qrY),
        left: Math.round(qrX),
      },
    ];

    // ─── Composite guest name (if enabled) ──────────────────────────────
    if (namePosition && guestName) {
      const fontSize = namePosition.fontSize || 24;
      const fontColor = namePosition.fontColor || '#000000';
      const fontFamily = namePosition.fontFamily || 'Playfair Display, serif';

      // Escape XML special characters in the guest name to avoid breaking the SVG
      const escapedName = escapeXml(guestName);

      // Create SVG text overlay
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

    // ─── Composite card number (optional) ──────────────────────────────
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

    // ─── Composite everything together ──────────────────────────────────
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

// ─── Helper: escape XML/SVG special characters ──────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Legacy function for backward compatibility ─────────────────────────

/**
 * @deprecated Use generateQRFromCardNumber instead
 */
export async function generateQRBuffer(
  data: string,
  size: number = 200
): Promise<Buffer> {
  // If the data looks like a card number (5 digits), use it directly
  const cleanData = data?.trim() || '00000';
  return await generateQRFromCardNumber(cleanData, size);
}

// ─── Generate guest token (kept for backward compatibility) ────────────

export function generateGuestToken(guestId: string, eventId: string): string {
  // This function is kept for backward compatibility
  // but QR codes now use card numbers instead
  return guestId;
}