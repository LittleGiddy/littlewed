// lib/image-storage.ts
import { put } from '@vercel/blob';
import { prisma } from './prisma';

/**
 * Generate and store a card image for a guest
 * Returns the static image URL
 */
// lib/image-storage.ts
export async function generateAndStoreCardImage(guestId: string): Promise<string> {
  try {
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      include: { event: true },
    });

    if (!guest) {
      throw new Error('Guest not found');
    }

    const event = guest.event;

    if (!event.templateCardUrl) {
      throw new Error('No invitation card configured for this event');
    }

    const guestName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://littlewed.co.tz';
    
    // ✅ Pass data as URL parameters
    const ogUrl = `${baseUrl}/api/og/card?name=${encodeURIComponent(guestName)}&template=${encodeURIComponent(event.templateCardUrl)}&cardNumber=${guest.cardNumber || ''}`;
    
    console.log('[ImageStorage] Generating image from:', ogUrl);
    
    const response = await fetch(ogUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // ─── Upload to Vercel Blob ───────────────────────────────────────────
    const blob = await put(
      `invitations/${guest.id}.png`,
      imageBuffer,
      {
        access: 'public',
        contentType: 'image/png',
        addRandomSuffix: false,
        allowOverwrite: true,
      }
    );

    return blob.url;
  } catch (error: any) {
    console.error('Failed to generate and store card image:', error);
    throw error;
  }
}