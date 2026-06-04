import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-me';

export function generateGuestToken(guestId: string, eventId: string): string {
  return jwt.sign({ guestId, eventId }, JWT_SECRET, { expiresIn: '30d' });
}

export async function generateQRBuffer(token: string, size: number = 200): Promise<Buffer> {
  // Force at least 200px to ensure scanability
  const qrSize = Math.max(200, size);
  return QRCode.toBuffer(token, {
    width: qrSize,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' }
  });
}

export async function compositeQROnCard(
  cardBuffer: Buffer,
  qrBuffer: Buffer,
  position: { x: number; y: number; size: number }
): Promise<Buffer> {
  const top = Math.round(position.y);
  const left = Math.round(position.x);
  const qrDisplaySize = Math.max(150, Math.round(position.size)); // visible size on card

  // Resize QR to the desired display size (preserves sharpness)
  const qrResized = await sharp(qrBuffer)
    .resize(qrDisplaySize, qrDisplaySize)
    .toBuffer();

  // Create a white background rectangle behind the QR
  const whiteBg = await sharp({
    create: {
      width: qrDisplaySize,
      height: qrDisplaySize,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  }).png().toBuffer();

  // Composite: first white rectangle, then QR on top
  return sharp(cardBuffer)
    .composite([
      { input: whiteBg, top, left },
      { input: qrResized, top, left }
    ])
    .png({ quality: 95 })
    .toBuffer();
}