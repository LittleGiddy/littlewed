// app/api/tenant/purchase-credits/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateCheckoutLink } from '@/lib/clickpesa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREDIT_COST = 500; // TZS per credit

export async function POST(req: NextRequest) {
  try {
    // ── Get session ──────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions);
    
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const userId = (session.user as any).id;
    
    // ── Parse request body ──────────────────────────────────────────────────
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      );
    }

    const { amount, returnUrl } = body;

    console.log('[PurchaseCredits] Request:', { 
      tenantId, 
      userId, 
      amount,
      returnUrl,
      userEmail: session.user.email 
    });

    // ── Validate amount ──────────────────────────────────────────────────────
    if (!amount || amount < CREDIT_COST) {
      return NextResponse.json(
        { error: `Minimum purchase is ${CREDIT_COST} TZS (1 credit)` },
        { status: 400 }
      );
    }

    // Calculate credits
    const credits = Math.floor(amount / CREDIT_COST);
    const totalPrice = credits * CREDIT_COST;

    console.log('[PurchaseCredits] Calculated:', { credits, totalPrice });

    // ── Validate environment credentials ────────────────────────────────────
    const clientId = process.env.CLICKPESA_CLIENT_ID;
    const apiKey = process.env.CLICKPESA_API_KEY;

    if (!clientId || !apiKey) {
      console.error('[PurchaseCredits] Missing credentials');
      return NextResponse.json(
        { error: 'Payment gateway not configured. Please contact support.' },
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

    console.log('[PurchaseCredits] Transaction created:', transaction.id);

    // ── Generate order reference ─────────────────────────────────────────────
    const orderReference = `cred${transaction.id.replace(/-/g, '').slice(0, 20)}`;

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { stripeSessionId: orderReference },
    });

    console.log('[PurchaseCredits] Order reference:', orderReference);

    // ── Get user details for ClickPesa ──────────────────────────────────────
    const user = session.user as any;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;

    // ── Generate ClickPesa checkout link ────────────────────────────────────
    console.log('[PurchaseCredits] Generating checkout link...');
    
    const result = await generateCheckoutLink({
      amount: totalPrice,
      orderReference: orderReference,
      customerName: user.name || 'Client',
      customerEmail: user.email || 'client@example.com',
      customerPhone: user.phone || '255712345678',
      description: `Purchase ${credits} credit${credits !== 1 ? 's' : ''} for LittleWed`,
    });

    console.log('[PurchaseCredits] Checkout generated:', result);

    return NextResponse.json({ 
      success: true,
      checkoutUrl: result.checkoutUrl,
      transactionId: transaction.id,
      credits,
      amount: totalPrice,
    });

  } catch (error: any) {
    console.error('[PurchaseCredits] Error:', error);
    
    return NextResponse.json(
      { 
        error: error.message || 'Failed to create payment',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}