// lib/image-storage.ts
import { put } from '@vercel/blob';
import { prisma } from './prisma';

export async function generateAndStoreCardImage(guestId: string): Promise<string> {
  try {
    // ─── Get guest with event data ─────────────────────────────────────
    const guest = await prisma.guest.findUnique({
      where: { id: guestId }, // ✅ Use id instead of passCode
      include: { event: true },
    });

    if (!guest) {
      throw new Error('Guest not found');
    }

    const event = guest.event;

    if (!event.templateCardUrl) {
      throw new Error('No invitation card configured for this event');
    }

    // ─── Generate the image using OG API ────────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://littlewed.co.tz';
    const ogUrl = `${baseUrl}/api/og/card?guestId=${guest.id}`; // ✅ Use guestId
    
    console.log('[ImageStorage] Generating image from:', ogUrl);
    
    const response = await fetch(ogUrl, {
      headers: {
        'Cache-Control': 'no-cache',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[ImageStorage] OG API error:', response.status, errorText);
      throw new Error(`Failed to generate image: ${response.status} - ${errorText}`);
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