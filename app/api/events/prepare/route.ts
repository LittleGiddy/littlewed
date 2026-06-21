import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const COMMISSION_PER_GUEST = 300; // TZS per guest

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
  // 2. NORMAL PAYMENT FLOW – ClickPesa checkout
  // ─────────────────────────────────────────────────────────────────
  const commission = guestCount * COMMISSION_PER_GUEST;

  // Create pending event
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

  // ClickPesa configuration
  const clickpesaApiKey = process.env.CLICKPESA_API_KEY;
  const clickpesaSecret = process.env.CLICKPESA_SECRET;
  const baseUrl = process.env.CLICKPESA_BASE_URL || 'https://api.clickpesa.com/v1';

  if (!clickpesaApiKey || !clickpesaSecret) {
    console.error('Missing ClickPesa credentials');
    await prisma.pendingEvent.delete({ where: { id: pending.id } }).catch(() => {});
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 });
  }

  // Try multiple possible endpoints
  const endpoints = ['/checkout/create', '/payment/checkout/initiate', '/checkout'];
  let checkoutUrl = null;
  let lastError = null;

  // Build base payload
  const basePayload = {
    amount: commission,
    currency: 'TZS',
    customer_email: (session.user as any).email || 'customer@example.com',
    customer_name: (session.user as any).name || 'Event Organizer',
    reference: `event_${pending.id}`,
    callback_url: `${process.env.NEXTAUTH_URL}/api/events/confirm?pendingId=${pending.id}`,
    redirect_url: `${process.env.NEXTAUTH_URL}/client/dashboard`,
    cancel_url: `${process.env.NEXTAUTH_URL}/client/events/new`,
    metadata: { pendingId: pending.id },
  };

  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    console.log(`Trying ClickPesa endpoint: ${url}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clickpesaApiKey}`,
          'X-Secret': clickpesaSecret,
        },
        body: JSON.stringify(basePayload),
      });

      const data = await response.json();

      console.log(`ClickPesa response status: ${response.status}`);
      console.log(`ClickPesa response body:`, JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error(`ClickPesa error at ${endpoint}:`, data);
        lastError = data;
        continue; // try next endpoint
      }

      // Try to extract checkout URL
      checkoutUrl = data.checkout_url || data.redirect_url || data.data?.checkout_url || data.url || data.payment_url;
      if (checkoutUrl) {
        console.log(`✅ Checkout URL found from ${endpoint}: ${checkoutUrl}`);
        break;
      }
      console.warn(`⚠️ No checkout URL in response from ${endpoint}`);
    } catch (err) {
      console.error(`Request failed for ${endpoint}:`, err);
      lastError = err;
    }
  }

  // If no checkout URL was found, clean up and return error
  if (!checkoutUrl) {
    console.error('All ClickPesa endpoints failed.');
    await prisma.pendingEvent.delete({ where: { id: pending.id } }).catch(() => {});
    return NextResponse.json(
      { error: 'Failed to initiate payment: no checkout URL. Check logs for details.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ checkoutUrl });
}