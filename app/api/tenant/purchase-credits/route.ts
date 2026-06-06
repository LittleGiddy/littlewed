import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await getServerSession();
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const tenantId = (session.user as any).tenantId;
  const { amount } = await req.json();

  const transaction = await prisma.transaction.create({
    data: {
      amount,
      type: 'CREDIT_PURCHASE',
      status: 'PENDING',
      tenantId,
    },
  });

  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'tzs',
          unit_amount: amount,
          product_data: { name: `Add ${amount} TZS credits` },
        },
        quantity: 1,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/client/billing?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/client/billing?canceled=true`,
    metadata: {
      tenantId,
      transactionId: transaction.id,
      amount: amount.toString(),
    },
  });

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { stripeSessionId: checkoutSession.id },
  });

  return NextResponse.json({ checkoutUrl: checkoutSession.url });
}