import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const COMMISSION_PER_GUEST = 300; // TZS per guest

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
  const { name, date, venue, address, guestCount } = await req.json();

  if (!name || !date || !venue || !address || !guestCount || guestCount < 1) {
    return NextResponse.json({ error: 'Invalid guest count (minimum 1)' }, { status: 400 });
  }

  // Check tenant bypass setting
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { bypassPayment: true, credits: true },
  });

  // ─────────────────────────────────────────────────────────────────
  // 1. BYPASS MODE (admin override) – create event instantly
  // ─────────────────────────────────────────────────────────────────
  if (tenant?.bypassPayment === true) {
    const event = await prisma.event.create({
      data: {
        name,
        date: new Date(date),
        venue,
        address,
        guestCount,
        total_budget: 0,
        commission_paid: true,
        tenantId,
      },
    });
    return NextResponse.json({ eventId: event.id, bypassed: true });
  }

  // ─────────────────────────────────────────────────────────────────
  // 2. NORMAL PAYMENT FLOW – ClickPesa hosted checkout
  // ─────────────────────────────────────────────────────────────────
  const commission = guestCount * COMMISSION_PER_GUEST;

  // Create pending event first (so we have an ID for the order reference)
  const pending = await prisma.pendingEvent.create({
    data: {
      name,
      date: new Date(date),
      venue,
      address,
      total_budget: commission,
      commission,
      guestCount,
      tenantId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  // Validate credentials
  const clientId = process.env.CLICKPESA_CLIENT_ID;
  const apiKey = process.env.CLICKPESA_API_KEY;

  if (!clientId || !apiKey) {
    console.error('Missing ClickPesa credentials (CLICKPESA_CLIENT_ID or CLICKPESA_API_KEY)');
    await prisma.pendingEvent.delete({ where: { id: pending.id } }).catch(() => {});
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 });
  }

  // Step 1: Get JWT token
  let jwtToken: string;
  try {
    jwtToken = await getClickPesaToken(clientId, apiKey);
  } catch (err: any) {
    console.error('ClickPesa auth error:', err.message);
    await prisma.pendingEvent.delete({ where: { id: pending.id } }).catch(() => {});
    return NextResponse.json(
      { error: `Payment gateway auth failed: ${err.message}` },
      { status: 500 }
    );
  }

  const user = session.user as any;

  // ClickPesa requires phone WITHOUT the leading '+' (e.g. 255712345678)
  const rawPhone: string = (user.phone || '255712345678').replace(/^\+/, '');

  // Order reference must be alphanumeric only (no underscores or hyphens)
  const orderReference = `event${pending.id.replace(/[^a-zA-Z0-9]/g, '')}`;

  // Step 2: Generate checkout link using the JWT
  const payload = {
    totalPrice: commission.toString(),
    orderReference,
    orderCurrency: 'TZS',                        // ← required field, was missing
    customerName: user.name || 'Event Organizer',
    customerEmail: user.email || 'customer@example.com',
    customerPhone: rawPhone,                       // ← no '+' prefix
    description: `Commission for event: ${name}`,
    callbackUrl: `${process.env.NEXTAUTH_URL}/api/events/confirm?pendingId=${pending.id}`,
  };

  console.log('ClickPesa checkout payload:', JSON.stringify(payload, null, 2));

  let checkoutUrl: string | null = null;

  try {
    const response = await fetch(
      'https://api.clickpesa.com/third-parties/checkout-link/generate-checkout-url',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // JWT token from step 1 already contains "Bearer " prefix
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
      await prisma.pendingEvent.delete({ where: { id: pending.id } }).catch(() => {});
      return NextResponse.json(
        { error: data.message || 'Payment initiation failed' },
        { status: response.status }
      );
    }

    // Per ClickPesa docs the response field is `checkoutLink`
    checkoutUrl = data.checkoutLink ?? null;

    if (!checkoutUrl) {
      console.error('No checkoutLink in ClickPesa response:', data);
      await prisma.pendingEvent.delete({ where: { id: pending.id } }).catch(() => {});
      return NextResponse.json(
        { error: 'Payment gateway returned no checkout URL' },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error('ClickPesa request failed:', err);
    await prisma.pendingEvent.delete({ where: { id: pending.id } }).catch(() => {});
    return NextResponse.json(
      { error: 'Network error contacting payment gateway' },
      { status: 500 }
    );
  }

  return NextResponse.json({ checkoutUrl });
}