// app/api/payment/create-checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateCheckoutLink } from '@/lib/clickpesa';

const CREDIT_COST = 300; // TZS per credit

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const userId = (session.user as any).id;
    const { amount, returnUrl } = await req.json();

    if (!amount || amount < CREDIT_COST) {
      return NextResponse.json(
        { error: `Minimum purchase is ${CREDIT_COST} TZS (1 credit)` },
        { status: 400 }
      );
    }

    // Calculate credits
    const credits = Math.floor(amount / CREDIT_COST);
    const totalPrice = credits * CREDIT_COST;

    // ── Validate environment credentials ────────────────────────────────────
    const apiKey = process.env.CLICKPESA_API_KEY;
    const apiSecret = process.env.CLICKPESA_API_SECRET;

    if (!apiKey || !apiSecret) {
      console.error('[ClickPesa] Missing CLICKPESA_API_KEY or CLICKPESA_API_SECRET');
      return NextResponse.json(
        { error: 'Payment gateway not configured. Set CLICKPESA_API_KEY and CLICKPESA_API_SECRET in environment variables.' },
        { status: 500 }
      );
    }

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
    const orderReference = `LITTLEWED-${transaction.id.slice(0, 8)}-${Date.now().toString().slice(-6)}`;

    // Update transaction with reference
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { stripeSessionId: orderReference },
    });

    const user = session.user as any;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;

    // ── Generate ClickPesa checkout link ────────────────────────────────────
    const { checkoutUrl, orderId } = await generateCheckoutLink({
      amount: totalPrice,
      orderReference: orderReference,
      customerName: user.name || 'Client',
      customerEmail: user.email || 'client@example.com',
      customerPhone: user.phone || '255712345678',
      description: `Purchase ${credits} credit${credits !== 1 ? 's' : ''} for LittleWed`,
    });

    console.log('[ClickPesa] Checkout created:', {
      transactionId: transaction.id,
      orderReference,
      orderId,
      checkoutUrl,
    });

    return NextResponse.json({ 
      checkoutUrl,
      transactionId: transaction.id,
    });

  } catch (error: any) {
    console.error('[ClickPesa] Error:', error);
    
    // Update transaction to failed if it exists
    try {
      const session = await getServerSession(authOptions);
      if (session) {
        const tenantId = (session.user as any).tenantId;
        const userId = (session.user as any).id;
        const { amount } = await req.json().catch(() => ({}));
        
        if (amount) {
          const credits = Math.floor(amount / CREDIT_COST);
          const totalPrice = credits * CREDIT_COST;
          
          const transaction = await prisma.transaction.create({
            data: {
              tenantId,
              amount: totalPrice,
              userId: userId,
              type: 'CREDIT_PURCHASE',
              status: 'FAILED',
            },
          });
        }
      }
    } catch {
      // Ignore
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create payment' },
      { status: 500 }
    );
  }
}