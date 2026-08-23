// lib/clickpesa.ts

const CLIENT_ID = process.env.CLICKPESA_CLIENT_ID!;
const API_KEY = process.env.CLICKPESA_API_KEY!;
const BASE_URL = process.env.CLICKPESA_BASE_URL || 'https://api.clickpesa.com';
const WEBHOOK_URL = process.env.CLICKPESA_WEBHOOK_URL;

// ─── Get Access Token ────────────────────────────────────────────────────
export async function getAccessToken(): Promise<string> {
  try {
    console.log('[ClickPesa] Getting token...');

    if (!CLIENT_ID || !API_KEY) {
      throw new Error('CLICKPESA_CLIENT_ID or CLICKPESA_API_KEY is missing');
    }

    // ✅ Use the same format as the working app
    const res = await fetch(`${BASE_URL}/generate-token`, {
      method: 'POST',
      headers: {
        'client-id': CLIENT_ID,
        'api-key': API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    const responseText = await res.text();
    console.log('[ClickPesa] Token response status:', res.status);
    console.log('[ClickPesa] Token response body:', responseText);

    if (!res.ok) {
      throw new Error(`Token generation failed (${res.status}): ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const token = data.token || data.accessToken || data.access_token;

    if (!token) {
      console.error('[ClickPesa] No token in response:', data);
      throw new Error(`No token returned: ${JSON.stringify(data)}`);
    }

    return token.startsWith('Bearer ') ? token : `Bearer ${token}`;
  } catch (error) {
    console.error('[ClickPesa] Token generation error:', error);
    throw error;
  }
}

// ─── Generate Checkout Link ──────────────────────────────────────────────
export async function generateCheckoutLink(params: {
  amount: number;
  orderReference: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
}): Promise<{ checkoutUrl: string; orderId?: string }> {
  try {
    const token = await getAccessToken();

    const payload = {
      totalPrice: params.amount.toString(),
      orderReference: params.orderReference,
      orderCurrency: 'TZS',
      customerName: params.customerName || '',
      customerEmail: params.customerEmail || '',
      customerPhone: params.customerPhone || '',
      description: params.description || '',
      callbackUrl: WEBHOOK_URL,
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL}/client/dashboard`,
    };

    console.log('[ClickPesa] Checkout payload:', JSON.stringify(payload, null, 2));

    const res = await fetch(`${BASE_URL}/checkout-link/generate-checkout-url`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    console.log('[ClickPesa] Checkout response status:', res.status);
    console.log('[ClickPesa] Checkout response body:', responseText);

    if (!res.ok) {
      throw new Error(`ClickPesa checkout error (${res.status}): ${responseText}`);
    }

    const data = JSON.parse(responseText);
    const checkoutUrl = data.checkoutLink || data.checkoutUrl || data.checkout_url;
    const orderId = data.orderId || data.order_id || data.id;

    if (!checkoutUrl) {
      console.error('[ClickPesa] No checkout URL:', data);
      throw new Error(`No checkout URL returned: ${JSON.stringify(data)}`);
    }

    return { checkoutUrl, orderId };
  } catch (error) {
    console.error('[ClickPesa] Generate checkout error:', error);
    throw error;
  }
}