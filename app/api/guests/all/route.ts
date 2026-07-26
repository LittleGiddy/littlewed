// app/api/guests/all/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Get the tenant from the session (adjust based on your auth)
  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
  }

  const guests = await prisma.guest.findMany({
    where: {
      event: {
        tenantId: tenantId,
      },
    },
    select: {
      id: true,
      name: true,
      phone: true,
      checkedIn: true,
      routingChannel: true,
      eventId: true,
      // we could also include event name
    },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json({ guests });
}