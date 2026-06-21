import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const COMMISSION_PER_GUEST = 300;

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

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { bypassPayment: true, credits: true },
  });

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

  const commission = guestCount * COMMISSION_PER_GUEST;

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
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const clickpesaApiKey = process.env.CLICKPESA_API_KEY;
  const clickpesaSecret = process.env.CLICKPESA_SECRET;
  const baseUrl = process.env.CLICKPESA_BASE_URL || 'https://api.clickpesa.com';

  if (!clickpesaApiKey || !clickpesaSecret) {
    await prisma.pendingEvent.delete({ where: { id: pending.id } }).catch(() => {});
    return NextResponse.json({ error: 'Payment gateway not configured' }, { status: 500 });
  }

  const user = session.user as any;
  const payload = {
    totalPrice: commission.toString(),
    orderReference: `event_${pending.id}`,
    customerName: user.name || 'Event Organizer',
    customerEmail: user.email || 'customer@example.com',
    customerPhone: user.phone || '+255712345678',
    description: `Commission for event: ${name}`,
    callbackUrl: `${process.env.NEXTAUTH_URL}/api/events/confirm?pendingId=${pending.id}`,
  };

  const endpoints = [
    {
      url: `${baseUrl}/third-parties/checkout-link/generate-checkout-url`,
      payload,
    },
    {
      url: `${baseUrl}/v1/third-parties/checkout-link/generate-checkout-url`,
      payload,
    },
    {
      url: `${baseUrl}/v1/checkout/create`,
      payload: {
        amount: commission,
        currency: 'TZS',
        customer_email: user.email,
        customer_name: user.name,
        reference: `event_${pending.id}`,
        callback_url: `${process.env.NEXTAUTH_URL}/api/events/confirm?pendingId=${pending.id}`,
        redirect_url: `${process.env.NEXTAUTH_URL}/client/dashboard`,
        cancel_url: `${process.env.NEXTAUTH_URL}/client/events/new`,
        metadata: { pendingId: pending.id },
      },
    },
  ];

  let checkoutUrl = null;
  let lastError = null;
  let lastResponse = null;

  for (const endpoint of endpoints) {
    console.log(`Trying ClickPesa endpoint: ${endpoint.url}`);

    try {
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${clickpesaApiKey}`,
          'X-Secret': clickpesaSecret,
        },
        body: JSON.stringify(endpoint.payload),
      });

      const data = await response.json();
      lastResponse = data;

      console.log(`ClickPesa response status: ${response.status}`);
      console.log(`ClickPesa response body:`, JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error(`ClickPesa error at ${endpoint.url}:`, data);
        lastError = data;
        continue;
      }

      checkoutUrl = data.checkoutLink || data.checkout_url || data.redirect_url || data.data?.checkout_url || data.url || data.payment_url;
      if (checkoutUrl) {
        console.log(`✅ Checkout URL found from ${endpoint.url}: ${checkoutUrl}`);
        break;
      }
      console.warn(`⚠️ No checkout URL in response from ${endpoint.url}`);
    } catch (err) {
      console.error(`Request failed for ${endpoint.url}:`, err);
      lastError = err;
    }
  }

  if (!checkoutUrl) {
    console.error('All ClickPesa endpoints failed. Last response:', lastResponse);
    await prisma.pendingEvent.delete({ where: { id: pending.id } }).catch(() => {});
    // Return the actual ClickPesa response for debugging
    return NextResponse.json(
      {
        error: 'Failed to initiate payment: no checkout URL',
        details: lastResponse || 'No response received',
        endpointAttempts: endpoints.map(e => e.url),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ checkoutUrl });
}