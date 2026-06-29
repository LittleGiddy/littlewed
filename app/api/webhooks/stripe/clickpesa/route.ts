import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const CREDIT_COST = 300;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    console.log('[ClickPesa Webhook] Raw body:', rawBody);

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      console.error('[ClickPesa Webhook] Failed to parse JSON');
      // Return 200 so ClickPesa doesn't retry with the same bad payload
      return NextResponse.json({ received: true });
    }

    console.log('[ClickPesa Webhook] Parsed payload:', JSON.stringify(body, null, 2));

    // ── 1. Extract the order reference ────────────────────────────────────────
    const orderReference: string | undefined =
      body.orderReference ||
      body.order_ref ||
      body.reference ||
      body.orderId ||
      body.transactionId;

    if (!orderReference) {
      console.warn('[ClickPesa Webhook] No orderReference in payload — ignoring');
      return NextResponse.json({ received: true });
    }

    // ── 2. Determine payment success ──────────────────────────────────────────
    const statusRaw: string = (
      body.status ||
      body.paymentStatus ||
      body.transactionStatus ||
      ''
    ).toUpperCase();

    const isSuccess =
      statusRaw === 'COMPLETED' ||
      statusRaw === 'SUCCESS' ||
      statusRaw === 'PAID' ||
      body.success === true ||
      body.completed === true;

    if (!isSuccess) {
      console.log(`[ClickPesa Webhook] Payment not successful (status: ${statusRaw}) — ignoring`);
      return NextResponse.json({ received: true });
    }

    // ── 3. Find the transaction by stripeSessionId (the stored orderReference) ─
    //
    // We store orderReference in stripeSessionId at purchase time.
    // This is the only reliable lookup — never try to reconstruct the UUID
    // from the reference string, because UUID hyphens get stripped.
    //
    const transaction = await prisma.transaction.findFirst({
      where: { stripeSessionId: orderReference },
    });

    if (!transaction) {
      console.warn(`[ClickPesa Webhook] No transaction found for orderReference: ${orderReference}`);
      return NextResponse.json({ received: true });
    }

    // ── 4. Idempotency guard ──────────────────────────────────────────────────
    if (transaction.status === 'COMPLETED') {
      console.log(`[ClickPesa Webhook] Transaction ${transaction.id} already completed — skipping`);
      return NextResponse.json({ received: true });
    }

    // ── 5. Calculate credits ──────────────────────────────────────────────────
    const creditsToAdd = Math.floor(transaction.amount / CREDIT_COST);
    if (creditsToAdd <= 0) {
      console.warn(`[ClickPesa Webhook] Amount too low for credits: ${transaction.amount} TZS`);
      return NextResponse.json({ received: true });
    }

    // ── 6. Atomically update transaction + tenant credits ─────────────────────
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED' },
      }),
      prisma.tenant.update({
        where: { id: transaction.tenantId },
        data: { credits: { increment: creditsToAdd } },
      }),
    ]);

    console.log(
      `[ClickPesa Webhook] ✅ Added ${creditsToAdd} credits to tenant ${transaction.tenantId} ` +
      `(transaction ${transaction.id})`
    );

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('[ClickPesa Webhook] Unhandled error:', error);
    // Still return 200 — returning 500 causes ClickPesa to retry endlessly
    return NextResponse.json({ received: true });
  }
}