import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const COST_PER_GUEST = 300;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  const { name, date, venue, address, guestCount } = await req.json();

  if (!name || !date || !venue || !address || !guestCount || guestCount < 1) {
    return NextResponse.json({ error: 'Invalid guest count (minimum 1)' }, { status: 400 });
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { credits: true, bypassPayment: true },
  });

  if (!tenant) {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
  }

  // Bypass mode (admin override)
  if (tenant.bypassPayment === true) {
    const event = await prisma.event.create({
      data: {
        name,
        date: new Date(date),
        venue,
        address,
        guestCount,
        total_budget: 0,
        commission_paid: true,
        tenantId,
      },
    });
    return NextResponse.json({ eventId: event.id, bypassed: true });
  }

  const requiredCredits = guestCount;
  if (tenant.credits >= requiredCredits) {
    const event = await prisma.$transaction(async (tx) => {
      await tx.tenant.update({
        where: { id: tenantId },
        data: { credits: { decrement: requiredCredits } },
      });
      return tx.event.create({
        data: {
          name,
          date: new Date(date),
          venue,
          address,
          guestCount,
          total_budget: requiredCredits * COST_PER_GUEST,
          commission_paid: true,
          tenantId,
        },
      });
    });
    return NextResponse.json({ eventId: event.id, creditsUsed: requiredCredits });
  }

  // Insufficient credits
  return NextResponse.json({
    error: 'Insufficient credits',
    available: tenant.credits,
    required: requiredCredits,
  }, { status: 400 });
}