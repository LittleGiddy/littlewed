import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// TZS to USD rate — replace with a live rate fetch if needed
const TZS_TO_USD_RATE = 2600;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'CLIENT') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { amount } = await req.json(); // amount in TZS

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // 1. Create a pending transaction record (always stored in TZS)
    const transaction = await prisma.transaction.create({
      data: {
        amount,
        type: 'CREDIT_PURCHASE',
        status: 'PENDING',
        tenantId,
      },
    });

    // 2. Convert TZS → USD cents for Stripe
    //    Stripe requires amounts in the currency's minor unit (cents for USD)
    const amountInUsdCents = Math.ceil((amount / TZS_TO_USD_RATE) * 100);

    // 3. Create Stripe Checkout session (charged in USD)
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: amountInUsdCents,
            product_data: { name: `Add ${amount.toLocaleString()} TZS credits` },
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

    // 4. Update transaction with Stripe session ID
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { stripeSessionId: checkoutSession.id },
    });

    return NextResponse.json({ checkoutUrl: checkoutSession.url });
  } catch (err: any) {
    console.error('[billing/checkout] FULL ERROR:', JSON.stringify(err, null, 2));

    // Surface Stripe-specific errors clearly
    if (err?.type?.startsWith('Stripe')) {
      return NextResponse.json(
        { error: `Stripe error: ${err.message}` },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}