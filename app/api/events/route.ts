// app/api/events/route.ts – collection route
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  const events = await prisma.event.findMany({
    where: { tenantId },
    orderBy: { date: 'asc' },
    include: { _count: { select: { guests: true } } },
  });

  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  // your create logic (if any)
}