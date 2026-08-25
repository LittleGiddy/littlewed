// app/api/tenant/purchase-credits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createPaymentIntent } from '@/lib/clickpesa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREDIT_COST = 500;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const userId = (session.user as any).id;
    const { amount } = await req.json();

    if (!amount || amount < CREDIT_COST) {
      return NextResponse.json(
        { error: `Minimum purchase is ${CREDIT_COST} TZS (1 credit)` },
        { status: 400 }
      );
    }

    const credits = Math.floor(amount / CREDIT_COST);
    const totalPrice = credits * CREDIT_COST;

    // ── Create pending transaction ──────────────────────────────────────────
    const transaction = await prisma.transaction.create({
      data: {
        tenantId,
        amount: totalPrice,
        userId: userId,
        type: 'CREDIT_PURCHASE',
        status: 'PENDING',
      },
    });

    const orderReference = `cred${transaction.id.replace(/-/g, '').slice(0, 20)}`;

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { stripeSessionId: orderReference },
    });

    const user = session.user as any;

    // ── Create ClickPesa payment intent ────────────────────────────────────
    const payment = await createPaymentIntent({
      amount: totalPrice,
      orderReference: orderReference,
      customerName: user.name || 'Client',
      customerEmail: user.email || 'client@example.com',
      customerPhone: user.phone || '255712345678',
      description: `Purchase ${credits} credits for LittleWed`,
    });

    // Store payment ID in transaction
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { stripeSessionId: payment.paymentId }, // Store payment ID for reference
    });

    console.log('[PurchaseCredits] Payment intent created:', payment);

    return NextResponse.json({ 
      success: true,
      paymentId: payment.paymentId,
      clientSecret: payment.clientSecret,
      transactionId: transaction.id,
      credits,
      amount: totalPrice,
      status: payment.status,
    });

  } catch (error: any) {
    console.error('[PurchaseCredits] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    );
  }
}