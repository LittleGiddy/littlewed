// app/api/webhooks/clickpesa/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREDIT_COST = 500;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    console.log('[ClickPesa Webhook] Raw body:', rawBody);

    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (err) {
      console.error('[ClickPesa Webhook] JSON parse error:', err);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    console.log('[ClickPesa Webhook] Parsed payload:', JSON.stringify(payload, null, 2));

    // ✅ API Integration webhook format
    const { 
      orderReference, 
      status, 
      paymentReference, 
      collectedAmount, 
      collectedCurrency 
    } = payload;

    if (!orderReference) {
      console.error('[ClickPesa Webhook] Missing orderReference');
      return NextResponse.json({ error: 'Missing orderReference' }, { status: 400 });
    }

    // Find transaction
    const transaction = await prisma.transaction.findFirst({
      where: { 
        OR: [
          { stripeSessionId: orderReference },
          { id: orderReference },
        ]
      },
    });

    if (!transaction) {
      console.warn(`[ClickPesa Webhook] Transaction not found: ${orderReference}`);
      return NextResponse.json({ received: true });
    }

    if (transaction.status === 'COMPLETED') {
      console.log(`[ClickPesa Webhook] Transaction ${transaction.id} already completed.`);
      return NextResponse.json({ received: true });
    }

    // ✅ Status is uppercase: 'SUCCESS'
    const isSuccess = status === 'SUCCESS' || status === 'COMPLETED';

    if (!isSuccess) {
      console.log(`[ClickPesa Webhook] Payment not successful: ${status}`);
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      return NextResponse.json({ received: true });
    }

    // Calculate credits
    let actualAmount = transaction.amount;
    if (collectedAmount) {
      const parsed = parseFloat(collectedAmount);
      if (!isNaN(parsed) && parsed > 0) {
        actualAmount = Math.round(parsed);
      }
    }

    const creditsToAdd = Math.floor(actualAmount / CREDIT_COST);
    if (creditsToAdd <= 0) {
      console.warn(`[ClickPesa Webhook] Amount (${actualAmount} TZS) too low.`);
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      return NextResponse.json({ received: true });
    }

    // Update everything
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: { 
          status: 'COMPLETED', 
          amount: actualAmount,
          stripeSessionId: paymentReference || orderReference,
        },
      }),
      prisma.tenant.update({
        where: { id: transaction.tenantId },
        data: { credits: { increment: creditsToAdd } },
      }),
      prisma.notification.create({
        data: {
          userId: transaction.userId!,
          title: 'Credits Purchased 🎉',
          message: `You have successfully purchased ${creditsToAdd} credit${creditsToAdd > 1 ? 's' : ''}! (${actualAmount.toLocaleString()} TZS)`,
          type: 'success',
        },
      }),
    ]);

    console.log(`[ClickPesa Webhook] ✅ Added ${creditsToAdd} credits`);

    return NextResponse.json({ 
      received: true, 
      processed: true,
      creditsAdded: creditsToAdd,
    });

  } catch (error) {
    console.error('[ClickPesa Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString()
  });
}