import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { eventId } = await params;

  // Verify the event belongs to the logged-in user
  const event = await prisma.event.findFirst({
    where: { id: eventId, userId: session.user.id }
  });

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 });
  }

  // Delete all guests for this event
  await prisma.guest.deleteMany({
    where: { eventId }
  });

  return NextResponse.json({ success: true, message: 'All guests deleted' });
}