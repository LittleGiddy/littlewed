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

    // ─── Extract fields - MATCHES THE WORKING WEBHOOK FORMAT ──────────────
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

    console.log('[ClickPesa Webhook] Processing:', { 
      orderReference, 
      status, 
      paymentReference, 
      collectedAmount 
    });

    // ─── Find the transaction ──────────────────────────────────────────────
    const transaction = await prisma.transaction.findFirst({
      where: { 
        OR: [
          { stripeSessionId: orderReference },
          { id: orderReference },
        ]
      },
    });

    if (!transaction) {
      console.warn(`[ClickPesa Webhook] Transaction not found for reference: ${orderReference}`);
      // Still return 200 to acknowledge receipt
      return NextResponse.json({ received: true });
    }

    // ─── Check if already processed ─────────────────────────────────────────
    if (transaction.status === 'COMPLETED') {
      console.log(`[ClickPesa Webhook] Transaction ${transaction.id} already completed.`);
      return NextResponse.json({ received: true });
    }

    // ─── Check if payment was successful ────────────────────────────────────
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

    // ─── Calculate credits based on actual amount ──────────────────────────
    let actualAmount = transaction.amount;
    if (collectedAmount) {
      const parsed = parseFloat(collectedAmount);
      if (!isNaN(parsed) && parsed > 0) {
        actualAmount = Math.round(parsed);
      }
    }

    console.log(`[ClickPesa Webhook] Intended: ${transaction.amount}, Actual: ${actualAmount}`);

    const creditsToAdd = Math.floor(actualAmount / CREDIT_COST);
    if (creditsToAdd <= 0) {
      console.warn(`[ClickPesa Webhook] Amount (${actualAmount} TZS) too low.`);
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      return NextResponse.json({ received: true });
    }

    // ─── Update transaction, tenant credits, and create notification ──────
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

    console.log(`[ClickPesa Webhook] ✅ Added ${creditsToAdd} credits to tenant ${transaction.tenantId}`);
    console.log(`[ClickPesa Webhook] ✅ Notification created for user ${transaction.userId}`);

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

// ─── GET endpoint for webhook verification ──────────────────────────────
export async function GET() {
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'ClickPesa webhook endpoint is active'
  });
}