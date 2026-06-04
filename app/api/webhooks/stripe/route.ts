import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error(`Webhook signature verification failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const metadata = session.metadata;
    if (!metadata) {
      console.error('No metadata in session');
      return NextResponse.json({ error: 'No metadata' }, { status: 400 });
    }

    const tenantId = metadata.tenantId;
    const transactionId = metadata.transactionId;
    const amount = metadata.amount;

    if (!tenantId || !transactionId || !amount) {
      console.error('Missing metadata fields:', { tenantId, transactionId, amount });
      return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
    }

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

  return NextResponse.json({ received: true });
}