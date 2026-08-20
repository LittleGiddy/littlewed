import { put } from '@vercel/blob';
import { generateQRFromCardNumber, compositeQROnCard } from './qr';

interface EventLike {
  tenantId: string;
  templateCardUrl: string | null;
  qrPlacementX: number | null;
  qrPlacementY: number | null;
  qrSize: number | null;
  includeName: boolean | null;
  namePlacementX: number | null;
  namePlacementY: number | null;
  nameFontSize: number | null;
  nameFontColor: string | null;
  nameFontFamily: string | null;
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

export async function generateCardForGuest(
  guest: any,
  event: EventLike,
  cardBuffer: Buffer
): Promise<string> {
  const qrPosition = {
    x: event.qrPlacementX ?? 100,
    y: event.qrPlacementY ?? 100,
    size: event.qrSize ?? 200,
  };

  const namePosition = event.includeName
    ? {
        x: event.namePlacementX ?? 50,
        y: event.namePlacementY ?? 50,
        fontSize: event.nameFontSize ?? 24,
        fontColor: event.nameFontColor ?? '#000000',
        fontFamily: event.nameFontFamily || 'Playfair Display, serif',
      }
    : null;

  const cardNumber = guest.cardNumber || '00000';
  const qrBuffer = await generateQRFromCardNumber(cardNumber, qrPosition.size);

  const finalCardBuffer = await compositeQROnCard(
    cardBuffer,
    qrBuffer,
    qrPosition,
    namePosition,
    event.includeName ? getGuestFullName(guest) : undefined,
    cardNumber
  );

  const blob = await put(`guests/${event.tenantId}/${guest.id}.png`, finalCardBuffer, {
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