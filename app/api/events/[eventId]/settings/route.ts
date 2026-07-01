import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ─── GET ──────────────────────────────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
    select: {
      templateCardUrl: true,
      // QR
      qrPlacementX: true,
      qrPlacementY: true,
      qrSize: true,
      qrColor: true,
      // Guest name
      includeName: true,
      namePlacementX: true,
      namePlacementY: true,
      nameFontSize: true,
      nameFontColor: true,
      // Event name overlay
      showEventName: true,
      eventNameX: true,
      eventNameY: true,
      eventNameSize: true,
      eventNameColor: true,
      // Date overlay
      showDate: true,
      dateX: true,
      dateY: true,
      dateSize: true,
      dateColor: true,
      // Venue overlay
      showVenue: true,
      venueX: true,
      venueY: true,
      venueSize: true,
      venueColor: true,
      // Artistic overlay
      overlayColor: true,
      overlayOpacity: true,
      // Custom message
      customMessage: true,
    },
  });

  return NextResponse.json(event || {});
}

// ─── PUT ──────────────────────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  const { eventId } = await params;

  const body = await req.json();

  // Build update data
  const updateData: any = {};

  // Template
  if (body.templateCardUrl !== undefined) updateData.templateCardUrl = body.templateCardUrl;

  // QR
  if (body.qrPlacementX !== undefined) updateData.qrPlacementX = body.qrPlacementX;
  if (body.qrPlacementY !== undefined) updateData.qrPlacementY = body.qrPlacementY;
  if (body.qrSize !== undefined) updateData.qrSize = body.qrSize;
  if (body.qrColor !== undefined) updateData.qrColor = body.qrColor;

  // Guest Name
  if (body.includeName !== undefined) updateData.includeName = body.includeName;
  if (body.namePlacementX !== undefined) updateData.namePlacementX = body.namePlacementX;
  if (body.namePlacementY !== undefined) updateData.namePlacementY = body.namePlacementY;
  if (body.nameFontSize !== undefined) updateData.nameFontSize = body.nameFontSize;
  if (body.nameFontColor !== undefined) updateData.nameFontColor = body.nameFontColor;

  // Event Name
  if (body.showEventName !== undefined) updateData.showEventName = body.showEventName;
  if (body.eventNameX !== undefined) updateData.eventNameX = body.eventNameX;
  if (body.eventNameY !== undefined) updateData.eventNameY = body.eventNameY;
  if (body.eventNameSize !== undefined) updateData.eventNameSize = body.eventNameSize;
  if (body.eventNameColor !== undefined) updateData.eventNameColor = body.eventNameColor;

  // Date
  if (body.showDate !== undefined) updateData.showDate = body.showDate;
  if (body.dateX !== undefined) updateData.dateX = body.dateX;
  if (body.dateY !== undefined) updateData.dateY = body.dateY;
  if (body.dateSize !== undefined) updateData.dateSize = body.dateSize;
  if (body.dateColor !== undefined) updateData.dateColor = body.dateColor;

  // Venue
  if (body.showVenue !== undefined) updateData.showVenue = body.showVenue;
  if (body.venueX !== undefined) updateData.venueX = body.venueX;
  if (body.venueY !== undefined) updateData.venueY = body.venueY;
  if (body.venueSize !== undefined) updateData.venueSize = body.venueSize;
  if (body.venueColor !== undefined) updateData.venueColor = body.venueColor;

  // Overlay
  if (body.overlayColor !== undefined) updateData.overlayColor = body.overlayColor;
  if (body.overlayOpacity !== undefined) updateData.overlayOpacity = body.overlayOpacity;

  // Custom message
  if (body.customMessage !== undefined) updateData.customMessage = body.customMessage;

  await prisma.event.updateMany({
    where: { id: eventId, tenantId },
    data: updateData,
  });

  return NextResponse.json({ success: true });
}