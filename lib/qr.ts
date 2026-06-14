import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-me';

export function generateGuestToken(guestId: string, eventId: string): string {
  return jwt.sign({ guestId, eventId }, JWT_SECRET, { expiresIn: '30d' });
}

export async function generateQRBuffer(token: string, size: number = 200, color: string = '#000000'): Promise<Buffer> {
  return QRCode.toBuffer(token, {
    width: size,
    margin: 1,
    color: { dark: color, light: '#FFFFFF' }
  });
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export async function compositeQROnCard(
  cardBuffer: Buffer,
  qrBuffer: Buffer,
  qrPosition: { x: number; y: number; size: number },
  namePosition?: { x: number; y: number; fontSize: number; fontColor: string; fontFamily?: string },
  guestName?: string
): Promise<Buffer> {
  const metadata = await sharp(cardBuffer).metadata();
  const cardWidth = metadata.width || 1000;
  const cardHeight = metadata.height || 1000;

  const composites = [];

  const qrTop = Math.round(qrPosition.y);
  const qrLeft = Math.round(qrPosition.x);
  const qrSize = Math.round(qrPosition.size);
  composites.push({
    input: qrBuffer,
    top: qrTop,
    left: qrLeft,
    width: qrSize,
    height: qrSize,
  });

  if (guestName && namePosition) {
    const svgText = `
      <svg width="${cardWidth}" height="${cardHeight}" xmlns="http://www.w3.org/2000/svg">
        <text
          x="${namePosition.x}"
          y="${namePosition.y}"
          font-family="${namePosition.fontFamily || 'Arial, sans-serif'}"
          font-size="${namePosition.fontSize}px"
          fill="${namePosition.fontColor}"
          text-anchor="middle"
          dominant-baseline="middle"
        >${escapeXml(guestName)}</text>
      </svg>
    `;
    const svgBuffer = Buffer.from(svgText);
    composites.push({
      input: svgBuffer,
      top: 0,
      left: 0,
      width: cardWidth,
      height: cardHeight,
    });
  }

  return sharp(cardBuffer)
    .composite(composites)
    .png({ quality: 95 })
    .toBuffer();
}