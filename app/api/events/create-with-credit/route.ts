import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  const { name, date, venue, address, guestCount } = await req.json();

  if (!name || !date || !venue || !address) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Check if tenant has at least 1 credit
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { credits: true },
  });

  if (!tenant || tenant.credits < 1) {
    return NextResponse.json({ error: 'Insufficient event credits' }, { status: 400 });
  }

  // Create the event (no payment required, commission_paid = true)
  const event = await prisma.$transaction(async (tx) => {
    const newEvent = await tx.event.create({
      data: {
        name,
        date: new Date(date),
        venue,
        address,
        guestCount: guestCount ? parseInt(guestCount) : 0,
        commission_paid: true,
        tenantId,
      },
    });

    // Deduct one credit
    await tx.tenant.update({
      where: { id: tenantId },
      data: { credits: { decrement: 1 } },
    });

    return newEvent;
  });

  return NextResponse.json({ eventId: event.id });
}