import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Get all events for this tenant
    const events = await prisma.event.findMany({
      where: { tenantId: id },
      select: { id: true },
    });
    const eventIds = events.map(e => e.id);

    // Delete in correct order
    await prisma.$transaction([
      prisma.guest.deleteMany({ where: { eventId: { in: eventIds } } }),
      prisma.event.deleteMany({ where: { tenantId: id } }),
      prisma.user.deleteMany({ where: { tenantId: id } }),
      prisma.pendingEvent.deleteMany({ where: { tenantId: id } }),
      prisma.transaction.deleteMany({ where: { tenantId: id } }),
      prisma.usageRecord.deleteMany({ where: { tenantId: id } }),
      prisma.tenant.delete({ where: { id } }),
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