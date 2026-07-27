import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ─── GET ────────────────────────────────────────────────────────────────
export async function GET(
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

    const event = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
      include: {
        guests: {
          select: {
            id: true,
            name: true,
            phone: true,
            routingChannel: true,
            checkedIn: true,
            attending: true,
            invitationSentAt: true,
            thanksSentAt: true,
            reminderCount: true,
          },
          orderBy: { name: 'asc' },
        },
        tenant: {
          select: {
            testMode: true,
            thanksCardUrl: true,
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    const { guests, tenant, ...eventData } = event;
    const thankYouCardUrl = eventData.thankYouCardUrl || tenant.thanksCardUrl || null;

    return NextResponse.json({
      event: { ...eventData, thankYouCardUrl },
      guests,
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PUT (Update Event) ────────────────────────────────────────────────
export async function PUT(
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
    const { name, venue, address, date } = await req.json();

    if (!name || !venue || !date) {
      return NextResponse.json(
        { error: 'Name, venue, and date are required' },
        { status: 400 }
      );
    }

    // Check if event exists and belongs to the user's tenant
    const existingEvent = await prisma.event.findFirst({
      where: { id: eventId, tenantId },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // Update the event
    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: {
        name,
        venue,
        address,
        date: new Date(date),
      },
    });

    return NextResponse.json({ success: true, event: updatedEvent });
  } catch (error) {
    console.error('Error updating event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE ─────────────────────────────────────────────────────────────
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  const { eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
  });
  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  await prisma.guest.deleteMany({ where: { eventId } });
  await prisma.event.delete({ where: { id: eventId } });

  return NextResponse.json({ success: true });
}