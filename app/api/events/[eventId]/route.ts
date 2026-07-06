import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
      event: {
        ...eventData,
        thankYouCardUrl,
        tenant: {
          testMode: tenant.testMode,
        },
      },
      guests,
    });
  } catch (error) {
    console.error('Error fetching event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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