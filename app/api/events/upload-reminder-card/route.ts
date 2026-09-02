// app/api/events/upload-reminder-card/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import cloudinary from '@/lib/cloudinary';
import { Readable } from 'stream';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = (session.user as any).tenantId;

    const formData = await req.formData();
    const file = formData.get('image') as File;
    const eventId = formData.get('eventId') as string;

    if (!file || !eventId) {
      return NextResponse.json({ error: 'Missing file or eventId' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Please upload a JPEG, JPG or PNG image.' },
        { status: 400 }
      );
    }

    if (file.size > 1 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image is too large. Maximum size is 1MB.' }, { status: 400 });
    }

    // Confirm this event belongs to the tenant
    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Upload to Cloudinary as PNG (backgrounds re-encoded for composition)
    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: `events/${eventId}/reminder-card`,
          format: 'png',
          overwrite: true,
          use_filename: true,
          unique_filename: true,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      const readable = new Readable();
      readable._read = () => {};
      readable.push(buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });

    const result = uploadResult as any;

    await prisma.event.update({
      where: { id: eventId, tenantId },
      data: { reminderCardUrl: result.secure_url },
    });

    return NextResponse.json({ url: result.secure_url, success: true });
  } catch (error: any) {
    console.error('Reminder card upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upload image' },
      { status: 500 }
    );
  }
}