// app/api/webhooks/clickpesa/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CREDIT_COST = 300;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    console.log('[ClickPesa Webhook] Raw body:', rawBody);

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (err) {
      console.error('[ClickPesa Webhook] JSON parse error:', err);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    console.log('[ClickPesa Webhook] Parsed payload:', JSON.stringify(body, null, 2));

    // ─── Extract data (supports both old and new formats) ────────────────
    // New API Application format: { data: { ... } }
    // Old Hosted format: { ... }
    let data = body.data || body;
    if (body.data && typeof body.data === 'object') {
      data = body.data;
    }

    // ─── Extract fields from both formats ────────────────────────────────
    const orderReference = data.orderReference || data.order_reference || data.order_ref;
    const status = data.status || data.payment_status;
    const collectedAmount = data.collectedAmount || data.amount || data.collected_amount;
    const transactionId = data.transaction_id || data.transactionId || data.id;

    console.log('[ClickPesa Webhook] Extracted data:', {
      orderReference,
      status,
      collectedAmount,
      transactionId,
    });

    if (!orderReference) {
      console.warn('[ClickPesa Webhook] No orderReference in payload — ignoring');
      return NextResponse.json({ received: true });
    }

    // ─── Check if payment was successful ──────────────────────────────────
    const successStatuses = ['SUCCESS', 'COMPLETED', 'success', 'completed', 'PAID'];
    if (!successStatuses.includes(status)) {
      console.log(`[ClickPesa Webhook] Payment not successful: ${status}`);
      
      // Update transaction status to FAILED
      const transaction = await prisma.transaction.findFirst({
        where: { 
          OR: [
            { stripeSessionId: orderReference },
            { id: orderReference },
          ]
        },
      });

      if (transaction && transaction.status !== 'COMPLETED') {
        await prisma.transaction.update({
          where: { id: transaction.id },
          data: { status: 'FAILED' },
        });
        console.log(`[ClickPesa Webhook] Transaction ${transaction.id} marked as FAILED`);
      }

      return NextResponse.json({ received: true });
    }

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
      // Could be a test webhook or old transaction - ignore
      return NextResponse.json({ received: true });
    }

    if (transaction.status === 'COMPLETED') {
      console.log(`[ClickPesa Webhook] Transaction ${transaction.id} already completed.`);
      return NextResponse.json({ received: true });
    }

    // ─── Calculate credits based on actual amount paid ────────────────────
    let actualAmount = transaction.amount;
    if (collectedAmount) {
      const parsed = parseFloat(collectedAmount);
      if (!isNaN(parsed) && parsed > 0) {
        actualAmount = Math.round(parsed);
      }
    }

    console.log(`[ClickPesa Webhook] Intended amount: ${transaction.amount}, Actual amount: ${actualAmount}`);

    const creditsToAdd = Math.floor(actualAmount / CREDIT_COST);
    if (creditsToAdd <= 0) {
      console.warn(`[ClickPesa Webhook] Actual amount (${actualAmount} TZS) too low for any credit.`);
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
          stripeSessionId: transactionId || orderReference,
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

    console.log(`[ClickPesa Webhook] ✅ Added ${creditsToAdd} credits to tenant ${transaction.tenantId} (based on actual payment of ${actualAmount} TZS)`);
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
export async function GET(req: NextRequest) {
  // Some payment providers send a GET request for verification
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    message: 'ClickPesa webhook endpoint is active'
  });
}