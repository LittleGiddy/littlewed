import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { refundCreditsForUnsentDeleted } from '@/lib/credits';

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
            email: true,
            title: true,
            guestType: true,
            cardNumber: true,
            passCode: true,
            routingChannel: true,
            checkedIn: true,
            attending: true,
            invitationSentAt: true,
            invitationCard: true,
            thanksSentAt: true,
            reminderCount: true,
            createdAt: true,
          },
          orderBy: { name: 'asc' },
        },
        tenant: {
          select: {
            testMode: true,
            thanksCardUrl: true,
            bypassPayment: true,
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
      bypassPayment: tenant.bypassPayment || false,
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
      include: {
        guests: { where: { checkedIn: true }, select: { id: true } },
      },
    });

    if (!existingEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // ─── Lock the date/time if any guest has already checked in ────────
    const newDate = new Date(date);
    if (isNaN(newDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    const dateChanged = Math.round(existingEvent.date.getTime()) !== Math.round(newDate.getTime());
    if (dateChanged && (existingEvent.guests?.length ?? 0) > 0) {
      return NextResponse.json(
        {
          error:
            'The event date/time can no longer be changed because one or more guests have already checked in, to avoid confusion during check-in.',
        },
        { status: 409 }
      );
    }

    const updateData: any = {
      name,
      venue,
      address,
      date: newDate,
    };

    // If the date changed, reset reminder flags so they trigger again
    // Use Math.round to avoid floating-point precision issues with getTime()
    if (Math.round(existingEvent.date.getTime()) !== Math.round(newDate.getTime())) {
      updateData.reminderSent = false;
      updateData.expiredNotified = false;
    }

    const updatedEvent = await prisma.event.update({
      where: { id: eventId },
      data: updateData,
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

  // Refund credits for guests that were never sent an invitation
  const unsentCount = await prisma.guest.count({
    where: { eventId, invitationSentAt: null },
  });

  await prisma.guest.deleteMany({ where: { eventId } });
  await prisma.event.delete({ where: { id: eventId } });

  if (unsentCount > 0) {
    await refundCreditsForUnsentDeleted(tenantId, eventId, unsentCount);
  }

  return NextResponse.json({ success: true });
}