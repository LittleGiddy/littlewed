import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const CREDIT_COST = 300; // TZS per credit (same as per guest commission)

async function getClickPesaToken(): Promise<string> {
  const clientId = process.env.CLICKPESA_CLIENT_ID;
  const apiKey = process.env.CLICKPESA_API_KEY;
  if (!clientId || !apiKey) {
    throw new Error('Missing ClickPesa credentials');
  }
  const response = await fetch('https://api.clickpesa.com/third-parties/generate-token', {
    method: 'POST',
    headers: {
      'client-id': clientId,
      'api-key': apiKey,
    },
  });
  const data = await response.json();
  if (!response.ok || !data.token) {
    throw new Error('Failed to generate ClickPesa token');
  }
  return data.token.startsWith('Bearer ') ? data.token : `Bearer ${data.token}`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  const { amount } = await req.json(); // amount in TZS
  if (!amount || amount < 300) {
    return NextResponse.json({ error: 'Minimum purchase is 300 TZS (1 credit)' }, { status: 400 });
  }

  const credits = Math.floor(amount / CREDIT_COST);
  const totalPrice = credits * CREDIT_COST;

  // Create a transaction record (pending)
  const transaction = await prisma.transaction.create({
    data: {
      tenantId,
      amount: totalPrice,
      type: 'CREDIT_PURCHASE',
      status: 'PENDING',
    },
  });

  try {
    const bearerToken = await getClickPesaToken();

    const payload = {
      totalPrice: totalPrice.toString(),
      orderReference: `credit_purchase_${transaction.id}`,
      customerName: (session.user as any).name || 'Client',
      customerEmail: (session.user as any).email || 'client@example.com',
      customerPhone: (session.user as any).phone || '255700000000',
      description: `Purchase ${credits} credits for LittleWed`,
      callbackUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/clickpesa`,
    };

    const response = await fetch(
      'https://api.clickpesa.com/third-parties/checkout-link/generate-checkout-url',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': bearerToken,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();
    if (!response.ok || !data.checkoutLink) {
      console.error('ClickPesa error:', data);
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      return NextResponse.json({ error: 'Payment gateway error' }, { status: 500 });
    }

    // Store the transaction ID in metadata for webhook
    // Update transaction with checkout session id if needed
    return NextResponse.json({ checkoutUrl: data.checkoutLink });
  } catch (error) {
    console.error('Credit purchase error:', error);
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'FAILED' },
    });
    return NextResponse.json({ error: 'Failed to initiate payment' }, { status: 500 });
  }
}