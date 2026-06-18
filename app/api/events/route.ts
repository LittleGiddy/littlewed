// app/api/events/route.ts (GET method)
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = (session.user as any).role;
  // ✅ Allow CLIENT and STAFF
  if (role !== 'CLIENT' && role !== 'STAFF') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No tenant associated' }, { status: 400 });
  }

  const events = await prisma.event.findMany({
    where: { tenantId },
    orderBy: { date: 'asc' },
    include: { _count: { select: { guests: true } } },
  });

  return NextResponse.json(events);
}