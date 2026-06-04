import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const pendingId = req.nextUrl.searchParams.get('pendingId');
  if (!pendingId) {
    return NextResponse.redirect(new URL('/client/events?error=missing', req.url));
  }

  const pending = await prisma.pendingEvent.findUnique({ where: { id: pendingId } });
  if (!pending) {
    return NextResponse.redirect(new URL('/client/events?error=expired', req.url));
  }

  // Create the real event
  await prisma.event.create({
    data: {
      name: pending.name,
      date: pending.date,
      venue: pending.venue,
      address: pending.address,
      total_budget: pending.total_budget,
      commission_paid: true,
      tenantId: pending.tenantId,
    },
  });

  await prisma.pendingEvent.delete({ where: { id: pendingId } });

  return NextResponse.redirect(new URL('/client/events?success=paid', req.url));
}