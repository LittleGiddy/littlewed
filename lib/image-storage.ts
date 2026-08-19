// lib/image-storage.ts
import { put } from '@vercel/blob';
import { prisma } from './prisma';

/**
 * Generate and store a card image for a guest
 * Returns the static image URL
 */
export async function generateAndStoreCardImage(guestId: string): Promise<string> {
  try {
    // ─── Get guest data ──────────────────────────────────────────────────
    const guest = await prisma.guest.findUnique({
      where: { id: guestId },
      include: { event: true },
    });

    if (!guest) {
      throw new Error('Guest not found');
    }

    if (!guest.passCode) {
      throw new Error('Guest has no pass code');
    }

    // ─── Generate the image using OG API ────────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://littlewed.co.tz';
    const ogUrl = `${baseUrl}/api/og/card?code=${guest.passCode}`;
    
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

    console.log('[ImageStorage] Uploaded to:', blob.url);

    return blob.url;
  } catch (error: any) {
    console.error('Failed to generate and store card image:', error);
    throw error;
  }
}

/**
 * Get card image URL from pass code (without storing)
 */
export function getCardImageUrl(passCode: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://littlewed.co.tz';
  return `${baseUrl}/api/og/card?code=${passCode}`;
}