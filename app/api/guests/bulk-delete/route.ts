import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { guestIds } = await req.json();
  if (!guestIds || !Array.isArray(guestIds) || guestIds.length === 0) {
    return NextResponse.json({ error: 'No guest IDs provided' }, { status: 400 });
  }

  const tenantId = (session.user as any).tenantId;

  // Verify these guests belong to the tenant's events
  const guests = await prisma.guest.findMany({
    where: {
      id: { in: guestIds },
      event: { tenantId },
    },
    select: { id: true },
  });

  if (guests.length === 0) {
    return NextResponse.json({ error: 'No valid guests found' }, { status: 404 });
  }

  const validIds = guests.map(g => g.id);
  const result = await prisma.guest.deleteMany({
    where: { id: { in: validIds } },
  });

  return NextResponse.json({ count: result.count });
}