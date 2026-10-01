// app/api/events/[eventId]/reminder-card-preview/route.ts
// Renders the reminder card exactly as it would be delivered, without sending
// or storing anything, so the tenant can check a real guest's card before
// committing credits.
//
// This calls the same composeReminderCard() the send path uses, so the preview
// cannot drift from the delivered image.
import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
  composeReminderCard,
  normaliseReminderAlign,
  DESIGNER_WIDTH,
} from '@/lib/image-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function fetchCardBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load the reminder card image');
  return Buffer.from(await res.arrayBuffer());
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as { role?: string }).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;
  const guestId = req.nextUrl.searchParams.get('guestId') ?? '';
  const nameParam = req.nextUrl.searchParams.get('name') ?? '';

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId: (session.user as { tenantId: string }).tenantId },
    select: {
      id: true,
      name: true,
      tenantId: true,
      reminderCardUrl: true,
      reminderCardNameX: true,
      reminderCardNameY: true,
      reminderCardNameSize: true,
      reminderCardNameColor: true,
      reminderCardNameAlign: true,
      reminderCardNameFont: true,
    },
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }
  if (!event.reminderCardUrl) {
    return NextResponse.json(
      { error: 'Choose or upload a reminder card first.' },
      { status: 400 }
    );
  }

  // A real guest proves the name will fit; a free-text name lets the tenant
  // check a name that is not on the list yet.
  let name = nameParam.trim().slice(0, 60);
  if (!name && guestId) {
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, eventId },
      select: { name: true, title: true },
    });
    if (!guest) {
      return NextResponse.json({ error: 'Guest not found' }, { status: 404 });
    }
    name = [guest.title, guest.name].filter(Boolean).join(' ');
  }

  if (!name) {
    return NextResponse.json(
      { error: 'Pick a guest or type a name to preview.' },
      { status: 400 }
    );
  }

  try {
    const cardBuffer = await fetchCardBuffer(event.reminderCardUrl);
    const { width } = await sharp(cardBuffer).metadata();

    const composed = await composeReminderCard(cardBuffer, name, {
      // The designer's size is authored against DESIGNER_WIDTH (800), matching the
      // scaleFactor the send path applies.
      fontSize: Math.round((event.reminderCardNameSize ?? 34) * ((width || 800) / DESIGNER_WIDTH)),
      fontFamily: event.reminderCardNameFont || 'Playfair Display',
      color: event.reminderCardNameColor || '#ffffff',
      align: normaliseReminderAlign(event.reminderCardNameAlign),
      xPct: event.reminderCardNameX ?? 50,
      yPct: event.reminderCardNameY ?? 40,
    });

    return new NextResponse(new Uint8Array(composed), {
      headers: {
        'Content-Type': 'image/png',
        // Design edits must show up on the next preview rather than a cached one.
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[ReminderCardPreview] Failed:', error);
    return NextResponse.json({ error: 'Could not build the preview' }, { status: 500 });
  }
}
