import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma';

const CREDIT_COST = 300;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    console.log('[ClickPesa Webhook] Raw body:', rawBody);

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (err) {
      console.error('JSON parse error:', err);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    console.log('[ClickPesa Webhook] Parsed payload:', JSON.stringify(body, null, 2));

    const { data } = body;
    if (!data) {
      console.warn('[ClickPesa Webhook] No data object in payload');
      return NextResponse.json({ received: true });
    }

    const orderReference = data.orderReference;
    const status = data.status;
    const collectedAmount = data.collectedAmount;

    if (!orderReference) {
      console.warn('[ClickPesa Webhook] No orderReference in payload — ignoring');
      return NextResponse.json({ received: true });
    }

    if (status !== 'SUCCESS' && status !== 'COMPLETED') {
      console.log(`[ClickPesa Webhook] Payment not successful: ${status}`);
      return NextResponse.json({ received: true });
    }

    const transaction = await prisma.transaction.findFirst({
      where: { stripeSessionId: orderReference },
    });

    if (!transaction) {
      console.warn(`[ClickPesa Webhook] Transaction not found for reference: ${orderReference}`);
      return NextResponse.json({ received: true });
    }

    if (transaction.status === 'COMPLETED') {
      console.log(`[ClickPesa Webhook] Transaction ${transaction.id} already completed.`);
      return NextResponse.json({ received: true });
    }

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

    // Update transaction, tenant credits, and create notification
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED', amount: actualAmount },
      }),
      prisma.tenant.update({
        where: { id: transaction.tenantId },
        data: { credits: { increment: creditsToAdd } },
      }),
      // ✅ Create notification for the user
      prisma.notification.create({
        data: {
          userId: transaction.userId!, // must be set
          title: 'Credits Purchased',
          message: `You have successfully purchased ${creditsToAdd} credit${creditsToAdd > 1 ? 's' : ''}!`,
          type: 'success',
        },
      }),
    ]);

    console.log(`[ClickPesa Webhook] ✅ Added ${creditsToAdd} credits to tenant ${transaction.tenantId} (based on actual payment of ${actualAmount} TZS)`);
    console.log(`[ClickPesa Webhook] ✅ Notification created for user ${transaction.userId}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[ClickPesa Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}