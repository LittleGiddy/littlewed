// app/api/events/[eventId]/thanks-card/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { v2 as cloudinary } from 'cloudinary';
import { mkdir } from 'fs/promises';
import path from 'path';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function uploadToCloudinary(buffer: Buffer, eventId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `thanks/${eventId}`,
        public_id: `thanks-card-${Date.now()}`,
        format: 'png',
        overwrite: true,
        use_filename: true,
        unique_filename: false,
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary] Thanks card upload error:', error);
          reject(error);
        } else {
          resolve(result?.secure_url || '');
        }
      }
    );
    stream.end(buffer);
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { eventId } = await params;

    const event = await prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File;
    if (!file) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 });
    }

    if (file.size > 1 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image is too large. Maximum size is 1MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ─── Prefer Cloudinary; fall back to local disk (local/dev only) ───
    let url: string;
    if (
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ) {
      url = await uploadToCloudinary(buffer, eventId);
    } else {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'thanks', eventId);
      await mkdir(uploadDir, { recursive: true });
      const filename = `thanks-card-${Date.now()}.png`;
      const filePath = path.join(uploadDir, filename);
      const { writeFile } = await import('fs/promises');
      await writeFile(filePath, buffer);
      url = `/uploads/thanks/${eventId}/${filename}`;
    }

    await prisma.event.update({
      where: { id: eventId },
      data: { thankYouCardUrl: url },
    });

    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    console.error('Thanks card upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload thanks card' },
      { status: 500 }
    );
  }
}
