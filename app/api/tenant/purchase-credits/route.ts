import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const CREDIT_COST = 300; // TZS per credit

// ─── ClickPesa: exchange client-id + api-key for a short-lived JWT ───────────
async function getClickPesaToken(clientId: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.clickpesa.com/third-parties/generate-token', {
    method: 'POST',
    headers: {
      'client-id': clientId,
      'api-key': apiKey,
    },
  });

  const data = await res.json();

  if (!res.ok || !data.token) {
    console.error('ClickPesa token generation failed:', data);
    throw new Error(data.message || 'Failed to generate ClickPesa auth token');
  }

  // data.token already includes the "Bearer " prefix per ClickPesa docs
  return data.token;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  const { amount } = await req.json();

  if (!amount || amount < 300) {
    return NextResponse.json({ error: 'Minimum purchase is 300 TZS (1 credit)' }, { status: 400 });
  }

  const credits = Math.floor(amount / CREDIT_COST);
  const totalPrice = credits * CREDIT_COST;

  // Create pending transaction
  const transaction = await prisma.transaction.create({
    data: {
      tenantId,
      amount: totalPrice,
      type: 'CREDIT_PURCHASE',
      status: 'PENDING',
    },
  });

  // Validate credentials
  const clientId = process.env.CLICKPESA_CLIENT_ID;
  const apiKey = process.env.CLICKPESA_API_KEY;

  if (!clientId || !apiKey) {
    console.error('Missing ClickPesa credentials (CLICKPESA_CLIENT_ID or CLICKPESA_API_KEY)');
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'FAILED' },
    });
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 });
  }

  // Step 1: Get JWT token
  let jwtToken: string;
  try {
    jwtToken = await getClickPesaToken(clientId, apiKey);
  } catch (err: any) {
    console.error('ClickPesa auth error:', err.message);
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'FAILED' },
    });
    return NextResponse.json(
      { error: `Payment gateway auth failed: ${err.message}` },
      { status: 500 }
    );
  }

  const user = session.user as any;

  // ClickPesa requires phone WITHOUT the leading '+' (e.g. 255712345678)
  const rawPhone: string = (user.phone || '255712345678').replace(/^\+/, '');

  // Order reference must be alphanumeric only (no underscores or hyphens)
  const orderReference = `credit${transaction.id.replace(/[^a-zA-Z0-9]/g, '')}`;

  // Step 2: Generate checkout link using the JWT
  const payload = {
    totalPrice: totalPrice.toString(),
    orderReference,
    orderCurrency: 'TZS',
    customerName: user.name || 'Client',
    customerEmail: user.email || 'client@example.com',
    customerPhone: rawPhone,
    description: `Purchase ${credits} credits for LittleWed`,
    callbackUrl: `${process.env.NEXTAUTH_URL}/api/webhooks/clickpesa`,
  };

  console.log('ClickPesa credit purchase payload:', JSON.stringify(payload, null, 2));

  let checkoutUrl: string | null = null;

  try {
    const response = await fetch(
      'https://api.clickpesa.com/third-parties/checkout-link/generate-checkout-url',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': jwtToken,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    console.log('ClickPesa checkout response status:', response.status);
    console.log('ClickPesa checkout response body:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      console.error('ClickPesa checkout error:', data);
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      return NextResponse.json(
        { error: data.message || 'Payment initiation failed' },
        { status: response.status }
      );
    }

    checkoutUrl = data.checkoutLink ?? null;

    if (!checkoutUrl) {
      console.error('No checkoutLink in ClickPesa response:', data);
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      return NextResponse.json(
        { error: 'Payment gateway returned no checkout URL' },
        { status: 500 }
      );
    }

    // Store order reference on transaction for webhook matching
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { stripeSessionId: orderReference },
    });

    return NextResponse.json({ checkoutUrl });
  } catch (err: any) {
    console.error('ClickPesa request failed:', err);
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'FAILED' },
    });
    return NextResponse.json(
      { error: 'Network error contacting payment gateway' },
      { status: 500 }
    );
  }
}