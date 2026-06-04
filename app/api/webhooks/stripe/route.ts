import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Handle the checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const { tenantId, transactionId, amount } = session.metadata;

    if (transactionId && tenantId) {
      // Use a transaction to ensure both updates succeed together
      await prisma.$transaction([
        prisma.transaction.update({
          where: { id: transactionId },
          data: { status: 'COMPLETED', stripeSessionId: session.id },
        }),
        prisma.tenant.update({
          where: { id: tenantId },
          data: { credits: { increment: parseInt(amount, 10) } },
        }),
      ]);
      console.log(`✅ Added ${amount} credits to tenant ${tenantId}`);
    }
  }

  return NextResponse.json({ received: true });
}