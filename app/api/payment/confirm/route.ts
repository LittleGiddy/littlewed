// app/api/payment/confirm/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { confirmPayment, getPaymentStatus } from '@/lib/clickpesa';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CREDIT_COST = 500;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { paymentId, paymentMethod, phoneNumber } = await req.json();

    if (!paymentId || !paymentMethod) {
      return NextResponse.json(
        { error: 'Payment ID and method are required' },
        { status: 400 }
      );
    }

    // Confirm the payment
    const result = await confirmPayment({
      paymentId,
      paymentMethod,
      phoneNumber,
    });

    console.log('[ConfirmPayment] Result:', result);

    // Find the transaction
    const transaction = await prisma.transaction.findFirst({
      where: { stripeSessionId: paymentId },
    });

    if (transaction) {
      // Update transaction status based on payment result
      const status = result.status === 'succeeded' ? 'COMPLETED' : 'FAILED';
      
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status },
      });

      // If successful, add credits
      if (result.status === 'succeeded') {
        const creditsToAdd = Math.floor(transaction.amount / CREDIT_COST);
        
        await prisma.$transaction([
          prisma.tenant.update({
            where: { id: transaction.tenantId },
            data: { credits: { increment: creditsToAdd } },
          }),
          prisma.notification.create({
            data: {
              userId: transaction.userId!,
              title: 'Credits Purchased 🎉',
              message: `You have successfully purchased ${creditsToAdd} credits!`,
              type: 'success',
            },
          }),
        ]);

        console.log(`[ConfirmPayment] Added ${creditsToAdd} credits to tenant ${transaction.tenantId}`);
      }
    }

    return NextResponse.json({
      success: true,
      status: result.status,
      transactionId: result.transactionId,
    });

  } catch (error: any) {
    console.error('[ConfirmPayment] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to confirm payment' },
      { status: 500 }
    );
  }
}