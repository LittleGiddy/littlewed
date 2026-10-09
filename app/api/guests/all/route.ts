// app/api/guests/all/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { eventScopeWhere } from '@/lib/eventAccess';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tenantId = (session.user as any).tenantId;
  if (!tenantId) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });

  // Staff only see guests whose event they were explicitly granted access to.
  const guests = await prisma.guest.findMany({
    where: { event: eventScopeWhere(session) },
    select: {
      id: true,
      name: true,
      phone: true,
      checkedIn: true,
      routingChannel: true,
      event: { select: { name: true } },
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ guests });
}