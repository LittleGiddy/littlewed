import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const COST_PER_GUEST = 500;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  console.log('🔑 Tenant ID from session:', tenantId);
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

  // Since credits are now deducted 1-per-guest when guests are added or
  // imported, creating the event does NOT charge credits upfront.
  const event = await prisma.event.create({
    data: {
      name,
      date: new Date(date),
      venue,
      address,
      guestCount,
      total_budget: tenant.bypassPayment ? 0 : guestCount * COST_PER_GUEST,
      commission_paid: true,
      tenantId,
    },
  });
  return NextResponse.json({ eventId: event.id, creditsUsed: 0, bypassed: !!tenant.bypassPayment });
}