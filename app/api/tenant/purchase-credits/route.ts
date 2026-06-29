import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const CREDIT_COST = 300; // TZS per credit

async function getClickPesaToken(clientId: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.clickpesa.com/third-parties/generate-token', {
    method: 'POST',
    headers: {
      'client-id': clientId,
      'api-key': apiKey,
    },
  });

  const data = await res.json();
  console.log('[ClickPesa] Token response:', JSON.stringify(data, null, 2));

  if (!res.ok || !data.token) {
    throw new Error(data.message || `Token generation failed (HTTP ${res.status})`);
  }

  // Normalise — ensure it has the "Bearer " prefix
  return data.token.startsWith('Bearer ') ? data.token : `Bearer ${data.token}`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const tenantId = (session.user as any).tenantId;
  const { amount, returnUrl } = await req.json();

  if (!amount || amount < CREDIT_COST) {
    return NextResponse.json(
      { error: `Minimum purchase is ${CREDIT_COST} TZS (1 credit)` },
      { status: 400 }
    );
  }

  const credits = Math.floor(amount / CREDIT_COST);
  const totalPrice = credits * CREDIT_COST;

  // ── Create pending transaction ─────────────────────────────────────────────
  const transaction = await prisma.transaction.create({
    data: {
      tenantId,
      amount: totalPrice,
      type: 'CREDIT_PURCHASE',
      status: 'PENDING',
    },
  });

  // ── Build orderReference ───────────────────────────────────────────────────
  //
  // IMPORTANT: store this exact string in stripeSessionId so the webhook
  // can do a simple findFirst({ where: { stripeSessionId: orderReference } }).
  // Keep it short — ClickPesa may truncate long references.
  //
  const orderReference = `cred${transaction.id.replace(/-/g, '').slice(0, 20)}`;

  // Store immediately so the webhook can always find the transaction,
  // even if the checkout request fails partway through.
  await prisma.transaction.update({
    where: { id: transaction.id },
    data: { stripeSessionId: orderReference },
  });

  // ── Validate env credentials ───────────────────────────────────────────────
  const clientId = process.env.CLICKPESA_CLIENT_ID;
  const apiKey = process.env.CLICKPESA_API_KEY;

  if (!clientId || !apiKey) {
    console.error('[ClickPesa] Missing CLICKPESA_CLIENT_ID or CLICKPESA_API_KEY in environment');
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { status: 'FAILED' },
    });
    return NextResponse.json(
      { error: 'Payment gateway not configured. Set CLICKPESA_CLIENT_ID and CLICKPESA_API_KEY in Vercel environment variables.' },
      { status: 500 }
    );
  }

  // ── Step 1: Get JWT ────────────────────────────────────────────────────────
  let jwtToken: string;
  try {
    jwtToken = await getClickPesaToken(clientId, apiKey);
  } catch (err: any) {
    console.error('[ClickPesa] Auth error:', err.message);
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

  // ClickPesa requires phone without leading '+'
  const rawPhone = (user.phone || '255712345678').replace(/^\+/, '');

  const appUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;

  const payload = {
    totalPrice: totalPrice.toString(),
    orderReference,
    orderCurrency: 'TZS',
    customerName: user.name || 'Client',
    customerEmail: user.email || 'client@example.com',
    customerPhone: rawPhone,
    description: `Purchase ${credits} credit${credits !== 1 ? 's' : ''} for LittleWed`,
    callbackUrl: `${appUrl}/api/webhooks/clickpesa`,
    redirectUrl: returnUrl || `${appUrl}/client/dashboard`,
  };

  console.log('[ClickPesa] Checkout payload:', JSON.stringify(payload, null, 2));

  // ── Step 2: Generate checkout link ─────────────────────────────────────────
  try {
    const response = await fetch(
      'https://api.clickpesa.com/third-parties/checkout-link/generate-checkout-url',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: jwtToken,
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    console.log('[ClickPesa] Checkout response status:', response.status);
    console.log('[ClickPesa] Checkout response body:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      return NextResponse.json(
        { error: data.message || 'Payment initiation failed' },
        { status: response.status }
      );
    }

    const checkoutUrl: string | null = data.checkoutLink ?? null;

    if (!checkoutUrl) {
      console.error('[ClickPesa] No checkoutLink in response:', data);
      await prisma.transaction.update({
        where: { id: transaction.id },
        data: { status: 'FAILED' },
      });
      return NextResponse.json(
        { error: 'Payment gateway returned no checkout URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({ checkoutUrl });

  } catch (err: any) {
    console.error('[ClickPesa] Request failed:', err);
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