// app/api/payment/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getPaymentStatus } from '@/lib/clickpesa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      return NextResponse.json(
        { error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    const status = await getPaymentStatus(paymentId);
    
    return NextResponse.json(status);
  } catch (error: any) {
    console.error('[PaymentStatus] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get payment status' },
      { status: 500 }
    );
  }
}