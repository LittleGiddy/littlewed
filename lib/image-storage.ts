// lib/image-storage.ts
import { put } from '@vercel/blob';
import { prisma } from './prisma';

export async function generateAndStoreCardImage(guestId: string): Promise<string> {
  try {
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

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://littlewed.co.tz';
    const ogUrl = `${baseUrl}/api/og/card?code=${guest.passCode}`;
    
    console.log('[ImageStorage] Generating image from:', ogUrl);
    
    const response = await fetch(ogUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    // ─── Upload to Vercel Blob with overwrite enabled ──────────────────
    const blob = await put(
      `invitations/${guest.id}.png`,
      imageBuffer,
      {
        access: 'public',
        contentType: 'image/png',
        addRandomSuffix: false,
        allowOverwrite: true, // ✅ Allow overwriting existing blobs
      }
    );

    console.log('[ImageStorage] Uploaded to:', blob.url);

    await prisma.guest.update({
      where: { id: guest.id },
      data: { invitationCard: blob.url },
    });

    return blob.url;
  } catch (error: any) {
    console.error('Failed to generate and store card image:', error);
    throw error;
  }
}