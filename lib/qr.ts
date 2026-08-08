import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-me';

// ─── Types ──────────────────────────────────────────────────────────────
interface QRPosition {
  x: number;
  y: number;
  size: number;
}

interface NamePosition {
  x: number;
  y: number;
  fontSize: number;
  fontColor: string;
  fontFamily?: string;
}

// ─── Generate Guest Token ──────────────────────────────────────────────
export function generateGuestToken(guestId: string, eventId: string): string {
  return jwt.sign({ guestId, eventId }, JWT_SECRET, { expiresIn: '30d' });
}

// ─── Generate QR Buffer ────────────────────────────────────────────────
export async function generateQRBuffer(
  token: string,
  size: number = 200,
  color: string = '#000000'
): Promise<Buffer> {
  return QRCode.toBuffer(token, {
    width: size,
    margin: 1,
    color: { dark: color, light: '#FFFFFF' },
  });
}

// ─── Escape XML ──────────────────────────────────────────────────────────
function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case "'":
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

// ─── Composite QR on Card ──────────────────────────────────────────────
export async function compositeQROnCard(
  cardBuffer: Buffer,
  qrBuffer: Buffer,
  qrPosition: QRPosition,
  namePosition?: NamePosition | null,
  guestName?: string,
  cardNumber?: string
): Promise<Buffer> {
  const metadata = await sharp(cardBuffer).metadata();
  const cardWidth = metadata.width || 1000;
  const cardHeight = metadata.height || 1000;

  const composites: sharp.OverlayOptions[] = [];

  // ─── QR Code ──────────────────────────────────────────────────────────
  // ✅ Resize the QR code buffer first, then composite it
  const qrSize = Math.round(qrPosition.size);
  const qrTop = Math.round(qrPosition.y);
  const qrLeft = Math.round(qrPosition.x);

  const resizedQrBuffer = await sharp(qrBuffer)
    .resize(qrSize, qrSize)
    .toBuffer();

  composites.push({
    input: resizedQrBuffer,
    top: qrTop,
    left: qrLeft,
  });

  // ─── Guest Name ──────────────────────────────────────────────────────
  if (guestName && namePosition) {
    const fontFamily = namePosition.fontFamily || 'Arial, sans-serif';
    let svgText = `
      <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
        <text
          x="${namePosition.x}"
          y="${namePosition.y}"
          font-family="${fontFamily}"
          font-size="${namePosition.fontSize}px"
          fill="${namePosition.fontColor}"
          text-anchor="middle"
          dominant-baseline="middle"
        >${escapeXml(guestName)}</text>
    `;

    if (cardNumber) {
      const cardNumberFontSize = Math.round(namePosition.fontSize * 0.6);
      svgText += `
        <text
          x="${namePosition.x}"
          y="${namePosition.y + namePosition.fontSize + 8}"
          font-family="DM Sans, Arial, sans-serif"
          font-size="${cardNumberFontSize}px"
          fill="${namePosition.fontColor}"
          text-anchor="middle"
          dominant-baseline="middle"
          opacity="0.8"
        >Card: ${escapeXml(cardNumber)}</text>
      `;
    }

    svgText += `</svg>`;

    const svgBuffer = Buffer.from(svgText);
    composites.push({
      input: svgBuffer,
      top: 0,
      left: 0,
    });
  }

  // ─── Composite ──────────────────────────────────────────────────────
  return sharp(cardBuffer)
    .composite(composites)
    .png({ quality: 95 })
    .toBuffer();
}