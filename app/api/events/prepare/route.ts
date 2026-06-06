import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import Stripe from 'stripe';

const COMMISSION_RATE = 0.05; // 5%

export async function POST(req: NextRequest) {
  // Initialize Stripe only when the function runs
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await getServerSession();
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  if (!tenantId) return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });

  const { name, date, venue, address, total_budget } = await req.json();
  if (!name || !date || !venue || !address || !total_budget || total_budget < 1000) {
    return NextResponse.json({ error: 'Invalid budget (minimum 1000 TZS)' }, { status: 400 });
  }

  const commission = Math.round(total_budget * COMMISSION_RATE);
  const pending = await prisma.pendingEvent.create({
    data: {
      name,
      date: new Date(date),
      venue,
      address,
      total_budget,
      commission,
      tenantId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const checkout = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'tzs',
          unit_amount: commission,
          product_data: { name: `Commission for "${name}"` },
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/events/confirm?pendingId=${pending.id}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/client/events/new`,
    metadata: { pendingId: pending.id },
  });

  return NextResponse.json({ checkoutUrl: checkout.url });
}