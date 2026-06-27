import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/prisma';

const CREDIT_COST = 300;

export async function POST(req: NextRequest) {
  try {
    // 1. Log the raw body
    const rawBody = await req.text();
    console.log('Raw webhook body:', rawBody);

    let body;
    try {
      body = JSON.parse(rawBody);
    } catch (err) {
      console.error('Failed to parse JSON:', err);
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    console.log('Parsed webhook payload:', JSON.stringify(body, null, 2));

    // 2. Try multiple possible field names
    const orderReference = body.orderReference || body.order_ref || body.reference || body.orderId || body.transactionId;
    const status = body.status || body.paymentStatus || body.transactionStatus;

    if (!orderReference) {
      console.warn('No orderReference found in payload');
      return NextResponse.json({ received: true });
    }

    // 3. Check if payment was successful
    const isSuccess = status?.toUpperCase() === 'COMPLETED' || 
                     status?.toUpperCase() === 'SUCCESS' ||
                     body.success === true ||
                     body.completed === true;

    if (!isSuccess) {
      console.log(`Payment not successful: ${status}`);
      return NextResponse.json({ received: true });
    }

    // 4. Extract transaction ID from reference
    let transactionId: string | null = null;
    const ref = orderReference as string;

    if (ref.startsWith('credit_')) {
      transactionId = ref.replace('credit_', '');
    } else if (ref.startsWith('credit')) {
      transactionId = ref.replace('credit', '');
    } else {
      // Try to find by the reference in the database
      const transaction = await prisma.transaction.findFirst({
        where: { stripeSessionId: ref },
      });
      if (transaction) {
        transactionId = transaction.id;
      }
    }

    if (!transactionId) {
      console.warn(`No transaction ID extracted from: ${ref}`);
      return NextResponse.json({ received: true });
    }

    // 5. Find and update the transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      console.warn(`Transaction not found: ${transactionId}`);
      return NextResponse.json({ received: true });
    }

    if (transaction.status === 'COMPLETED') {
      console.log(`Transaction ${transactionId} already completed.`);
      return NextResponse.json({ received: true });
    }

    const creditsToAdd = Math.floor(transaction.amount / CREDIT_COST);
    if (creditsToAdd <= 0) {
      console.warn(`Amount too low for credits: ${transaction.amount} TZS`);
      return NextResponse.json({ received: true });
    }

    // 6. Update credits and transaction
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transactionId },
        data: { status: 'COMPLETED' },
      }),
      prisma.tenant.update({
        where: { id: transaction.tenantId },
        data: { credits: { increment: creditsToAdd } },
      }),
    ]);

    console.log(`✅ Added ${creditsToAdd} credits to tenant ${transaction.tenantId}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}