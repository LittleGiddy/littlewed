import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadToBlob } from '@/lib/storage';

interface SessionUser {
  role?: string;
  tenantId?: string;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  try {
    const { eventId } = await params;
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as SessionUser)?.role;
    const tenantId = (session.user as SessionUser)?.tenantId;
    if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }
    if (role !== 'SUPER_ADMIN' && event.tenantId !== tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const kind = (formData.get('kind') as string) === 'couple' ? 'guest-page-couple' : 'guest-page-header';
    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `events/${eventId}/${kind}-${Date.now()}.png`;
    const url = await uploadToBlob(key, buffer, file.type);

    await prisma.event.update({
      where: { id: eventId },
      data:
        kind === 'guest-page-couple'
          ? { guestPageCoupleImage: url }
          : { guestPageHeaderImage: url },
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('POST /api/events/[eventId]/guest-page/upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}