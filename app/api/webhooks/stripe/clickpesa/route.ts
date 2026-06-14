import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('ClickPesa webhook payload:', body);

    // Extract payment details – adjust according to actual payload structure
    const { orderReference, status, amount } = body;

    // Only process successful payments
    if (status !== 'COMPLETED' && status !== 'SUCCESS') {
      return NextResponse.json({ received: true });
    }

    // Find the pending transaction using the order reference
    const transaction = await prisma.transaction.findFirst({
      where: { stripeSessionId: orderReference, status: 'PENDING' },
    });

    if (!transaction) {
      console.warn(`No pending transaction found for orderReference: ${orderReference}`);
      return NextResponse.json({ received: true });
    }

    // Add credits to the tenant and mark transaction as completed
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'COMPLETED' },
      }),
      prisma.tenant.update({
        where: { id: transaction.tenantId },
        data: { credits: { increment: transaction.amount } },
      }),
    ]);

    console.log(`Credits added: +${transaction.amount} for tenant ${transaction.tenantId}`);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}