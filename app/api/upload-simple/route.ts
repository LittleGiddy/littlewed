import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_SIZE = 1 * 1024 * 1024;
const EVENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as { role?: string }).role || '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = (session.user as { tenantId?: string }).tenantId;

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const eventId = formData.get('eventId') as string;

    if (!file || !eventId) {
      return NextResponse.json({ error: 'Missing file or eventId' }, { status: 400 });
    }

    if (!EVENT_ID_PATTERN.test(eventId)) {
      return NextResponse.json({ error: 'Invalid event ID' }, { status: 400 });
    }

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
      select: { id: true },
    });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image is too large. Maximum size is 1MB.' }, { status: 400 });
    }

    const type = (file.type || '').toLowerCase();
    if (type !== 'image/png' && type !== 'image/jpeg') {
      return NextResponse.json({ error: 'Only PNG or JPEG images are allowed' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', eventId);
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, 'base-card.png');
    await writeFile(filePath, buffer);
    const url = `/uploads/${eventId}/base-card.png`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}