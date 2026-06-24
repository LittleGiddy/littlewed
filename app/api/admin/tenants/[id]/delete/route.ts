import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: tenantId } = await params;

  // Get all events for this tenant (to delete guests later)
  const events = await prisma.event.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const eventIds = events.map(e => e.id);

  // Get all users for this tenant (to delete notifications later)
  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true },
  });
  const userIds = users.map(u => u.id);

  try {
    await prisma.$transaction([
      // 1. Delete all notifications belonging to these users
      prisma.notification.deleteMany({
        where: { userId: { in: userIds } },
      }),
      // 2. Delete guests (using eventIds)
      prisma.guest.deleteMany({ where: { eventId: { in: eventIds } } }),
      // 3. Delete events
      prisma.event.deleteMany({ where: { tenantId } }),
      // 4. Delete users (now that notifications are gone)
      prisma.user.deleteMany({ where: { tenantId } }),
      // 5. Delete pending events
      prisma.pendingEvent.deleteMany({ where: { tenantId } }),
      // 6. Delete transactions
      prisma.transaction.deleteMany({ where: { tenantId } }),
      // 7. Delete usage records
      prisma.usageRecord.deleteMany({ where: { tenantId } }),
      // 8. Finally delete the tenant itself
      prisma.tenant.delete({ where: { id: tenantId } }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete organisation' },
      { status: 500 }
    );
  }
}