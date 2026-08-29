// app/api/tenant/purchase-credits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateCheckoutLink } from '@/lib/clickpesa';

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

    // ── Generate order reference ─────────────────────────────────────────────
    const orderReference = `cred${transaction.id.replace(/-/g, '').slice(0, 20)}`;

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { stripeSessionId: orderReference },
    });

    const user = session.user as any;

    // ── Generate ClickPesa checkout link ────────────────────────────────────
    const { checkoutUrl } = await generateCheckoutLink({
      amount: totalPrice,
      orderReference: orderReference,
      customerName: user.name || 'Client',
      customerEmail: user.email || 'client@example.com',
      customerPhone: user.phone || '255712345678',
      description: `Purchase ${credits} credit${credits !== 1 ? 's' : ''} for LittleWed`,
    });

    console.log('[PurchaseCredits] Checkout URL generated:', checkoutUrl);

    return NextResponse.json({ 
      success: true,
      checkoutUrl,
      transactionId: transaction.id,
      credits,
      amount: totalPrice,
    });

  } catch (error: any) {
    console.error('[PurchaseCredits] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    );
  }
}