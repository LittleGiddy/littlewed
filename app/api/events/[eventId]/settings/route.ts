// app/api/events/[eventId]/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Event columns that back the Mchango reminder template's var1..var13 slots.
 * Declared here so the writer stays in step with the editor that drives it.
 */
const MCHANGO_EVENT_FIELDS = [
  'eventType',
  'contributionDeadline',
  'mpesaInstructions',
  'airtelInstructions',
  'bankInstructions',
  'hostFamily',
  'person1',
  'person2',
  'contactPerson',
  'contactPersonPhone',
  'venue',
  'address',
] as const;

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
      qrPlacementX: true,
      qrPlacementY: true,
      qrSize: true,
      qrColor: true,
      qrRotation: true, // ✅ Added
      includeName: true,
      namePlacementX: true,
      namePlacementY: true,
      nameFontSize: true,
      nameFontColor: true,
      showEventName: true,
      eventNameX: true,
      eventNameY: true,
      eventNameSize: true,
      eventNameColor: true,
      showDate: true,
      dateX: true,
      dateY: true,
      dateSize: true,
      dateColor: true,
      showVenue: true,
      venueX: true,
      venueY: true,
      venueSize: true,
      venueColor: true,
      overlayColor: true,
      overlayOpacity: true,
      customMessage: true,
      designLayers: true,
      thankYouCardUrl: true,
      reminderCardUrl: true,
      reminderCardNameX: true,
      reminderCardNameY: true,
      reminderCardNameSize: true,
      reminderCardNameColor: true,
      reminderCardNameAlign: true,
      reminderCardNameFont: true,
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
  if (body.qrRotation !== undefined) updateData.qrRotation = body.qrRotation; // ✅ Added

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
  if (body.designLayers !== undefined) updateData.designLayers = body.designLayers;

  // Thank You Card
  if (body.thankYouCardUrl !== undefined) updateData.thankYouCardUrl = body.thankYouCardUrl;

  // Reminder Card (WhatsApp reminder designer)
  if (body.reminderCardUrl !== undefined) updateData.reminderCardUrl = body.reminderCardUrl;
  if (body.reminderCardNameX !== undefined) updateData.reminderCardNameX = body.reminderCardNameX;
  if (body.reminderCardNameY !== undefined) updateData.reminderCardNameY = body.reminderCardNameY;
  if (body.reminderCardNameSize !== undefined) updateData.reminderCardNameSize = body.reminderCardNameSize;
  if (body.reminderCardNameColor !== undefined) updateData.reminderCardNameColor = body.reminderCardNameColor;
  if (body.reminderCardNameAlign !== undefined) updateData.reminderCardNameAlign = body.reminderCardNameAlign;
  if (body.reminderCardNameFont !== undefined) updateData.reminderCardNameFont = body.reminderCardNameFont;

  // ─── Mchango template variables (var1..var13) ───────────────────────
  // These back the reminder editor. Each one is a real Event column rather than
  // a free-text blob, so the contribution tracker and the public share page
  // read the same values the tenant typed here. `hostFamily`/`person1`/
  // `person2`/`contactPersonPhone` had no writer anywhere in the app until
  // now, which is why every Mchango slot used to render as an em dash.
  for (const key of MCHANGO_EVENT_FIELDS) {
    if (body[key] === undefined) continue;
    const value = body[key];
    updateData[key] =
      key === 'contributionDeadline'
        ? value
          ? new Date(String(value))
          : null
        : value === ''
          ? null
          : String(value).slice(0, 400);
  }

  // Guard against a value the column cannot hold.
  if (updateData.contributionDeadline && Number.isNaN(updateData.contributionDeadline.getTime())) {
    delete updateData.contributionDeadline;
  }

  await prisma.event.updateMany({
    where: { id: eventId, tenantId },
    data: updateData,
  });

  return NextResponse.json({ success: true });
}