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

// ─── Printable QR sticker sheets ─────────────────────────────────────────
// An A4 page (portrait) of QR codes that are cut out and stuck onto printed
// cards by hand. Each sticker encodes a guest's card number — the exact same
// value the invitation-card QR encodes — so scanning a sticker with the staff
// scanner marks the card valid. Kept black-on-white for reliable scanning.

export interface QrPrintEntry {
  /** PNG QR buffer (with quiet zone) to place on the sheet. */
  qr: Buffer;
  /** The card number this sticker encodes, shown as the label. */
  cardNumber: string;
  /** Short human-readable label under the QR (which card it belongs to). */
  label: string;
}

/** A4 portrait @ 200dpi (210mm × 297mm). */
const SHEET_WIDTH = 1654;
const SHEET_HEIGHT = 2339;
/** Stickers per sheet: 4 columns × 5 rows. */
const SHEET_COLS = 4;
const SHEET_ROWS = 5;
export const QR_SHEET_PAGE_SIZE = SHEET_COLS * SHEET_ROWS;
/** Side of the QR square in sheet pixels (~36mm when printed). */
const SHEET_QR_SIZE = 340;

/** Truncate long guest names so the sheet stays tidy. */
function fitLabel(label: string): string {
  const clean = label.trim();
  return clean.length > 26 ? `${clean.slice(0, 25)}…` : clean;
}

/**
 * Rasterize a sheet of up to 20 QR stickers (each with its card number and a
 * name underneath) into a single A4 PNG. `entries` longer than one page are
 * trimmed to the first page — the caller paginates beforehand.
 */
export async function buildQrPrintSheet(entries: QrPrintEntry[]): Promise<Buffer> {
  if (entries.length === 0) {
    throw new Error('No QR stickers to arrange on a sheet');
  }

  const cellW = Math.floor(SHEET_WIDTH / SHEET_COLS);
  const cellH = Math.floor(SHEET_HEIGHT / SHEET_ROWS);
  const padY = 30;
  const padX = Math.floor((cellW - SHEET_QR_SIZE) / 2);

  const layers: sharp.OverlayOptions[] = [];
  const texts: string[] = [];

  const visible = entries.slice(0, QR_SHEET_PAGE_SIZE);
  visible.forEach((entry, i) => {
    const col = i % SHEET_COLS;
    const row = Math.floor(i / SHEET_COLS);
    const left = Math.round(col * cellW + padX);
    const top = Math.round(row * cellH + padY);
    const centerX = left + Math.round(SHEET_QR_SIZE / 2);

    layers.push({ input: entry.qr, top, left });

    const numberY = top + SHEET_QR_SIZE + 40;
    const nameY = numberY + 44;
    texts.push(
      `<text x="${centerX}" y="${numberY}" font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="bold" fill="#111111" text-anchor="middle">#${escapeXml(entry.cardNumber)}</text>`,
      `<text x="${centerX}" y="${nameY}" font-family="Arial, Helvetica, sans-serif" font-size="26" fill="#555555" text-anchor="middle">${escapeXml(fitLabel(entry.label))}</text>`
    );
  });

  const labelsSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SHEET_WIDTH}" height="${SHEET_HEIGHT}">` +
    texts.join('') +
    '</svg>';

  return sharp({
    create: {
      width: SHEET_WIDTH,
      height: SHEET_HEIGHT,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([...layers, { input: Buffer.from(labelsSvg), top: 0, left: 0 }])
    .png({ compressionLevel: 9 })
    .toBuffer();
}

export function generateGuestToken(guestId: string, eventId: string): string {
  return guestId;
}