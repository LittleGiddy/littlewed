import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fetchTemplateBuffer, generateCardForGuest } from '@/lib/image-storage';

const GUEST_TYPES = ['SINGLE', 'DOUBLE', 'FAMILIA', 'WAKWE'];

/**
 * POST /api/events/[eventId]/preview-card
 *
 * Renders the FINAL card image (real font outlines, design layers, QR code) for
 * the current, possibly unsaved, design, using a sample guest - so tenants can
 * preview the exact card a guest will get without generating any real card.
 *
 * The request body carries the current designer state (template URL, overlay,
 * QR placement, design layers) and optional sample guest fields. Nothing is
 * written to the database; the composited image is uploaded to Cloudinary under
 * a per-event public id so regenerating overwrites the same file.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const role = (session.user as { role?: string }).role;
    if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const tenantId = (session.user as { tenantId?: string }).tenantId;
    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const { eventId } = await params;
    const event = await prisma.event.findFirst({ where: { id: eventId, tenantId } });
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));

    const templateCardUrl =
      typeof body.templateCardUrl === 'string' && body.templateCardUrl
        ? body.templateCardUrl
        : event.templateCardUrl;

    if (!templateCardUrl) {
      return NextResponse.json(
        { error: 'No card template. Upload a background first.' },
        { status: 400 }
      );
    }

    const mergedEvent = {
      tenantId,
      name: event.name,
      venue: event.venue,
      date: event.date,
      templateCardUrl,
      includeName: event.includeName,
      namePlacementX: event.namePlacementX,
      namePlacementY: event.namePlacementY,
      nameFontSize: event.nameFontSize,
      nameFontColor: event.nameFontColor,
      nameFontFamily: event.nameFontFamily,
      overlayColor:
        typeof body.overlayColor === 'string' ? body.overlayColor : event.overlayColor,
      overlayOpacity:
        typeof body.overlayOpacity === 'number' ? body.overlayOpacity : event.overlayOpacity,
      qrPlacementX:
        typeof body.qrPlacementX === 'number' ? body.qrPlacementX : event.qrPlacementX,
      qrPlacementY:
        typeof body.qrPlacementY === 'number' ? body.qrPlacementY : event.qrPlacementY,
      qrSize: typeof body.qrSize === 'number' ? body.qrSize : event.qrSize,
      qrColor: typeof body.qrColor === 'string' ? body.qrColor : event.qrColor,
      qrRotation: typeof body.qrRotation === 'number' ? body.qrRotation : event.qrRotation,
      designLayers: Array.isArray(body.designLayers) ? body.designLayers : event.designLayers,
    };

    const guest = body?.guest && typeof body.guest === 'object' ? body.guest : {};
    const sampleGuest = {
      // A fixed id keeps the preview upload on ONE Cloudinary file per event.
      id: `preview-${eventId}`,
      title: typeof guest.title === 'string' && guest.title ? guest.title : 'Mr & Mrs',
      name:
        typeof guest.name === 'string' && guest.name.trim() ? guest.name.trim() : 'Juma & Amina Hassan',
      cardNumber:
        typeof guest.cardNumber === 'string' && guest.cardNumber.trim()
          ? guest.cardNumber.trim()
          : '00025',
      guestType: GUEST_TYPES.includes(guest.guestType) ? guest.guestType : 'DOUBLE',
      guestCount: typeof guest.guestCount === 'number' && guest.guestCount > 0 ? guest.guestCount : 2,
    };

    const cardBuffer = await fetchTemplateBuffer(templateCardUrl);
    const url = await generateCardForGuest(sampleGuest, mergedEvent, cardBuffer);

    return NextResponse.json({ url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Preview failed';
    console.error('POST /api/events/[eventId]/preview-card error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}