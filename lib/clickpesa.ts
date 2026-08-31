// lib/clickpesa.ts - HOSTED INTEGRATION

const CLIENT_ID = process.env.CLICKPESA_CLIENT_ID!;
const API_KEY = process.env.CLICKPESA_API_KEY!;
const BASE_URL = process.env.CLICKPESA_BASE_URL || 'https://api.clickpesa.com';
const WEBHOOK_URL = process.env.CLICKPESA_WEBHOOK_URL;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL?.replace(/\/+$/, '') || 'https://littlewed.co.tz';

// ─── Get Access Token ────────────────────────────────────────────────────
export async function getAccessToken(): Promise<string> {
  try {
    console.log('[ClickPesa] Getting token...');

    if (!CLIENT_ID || !API_KEY) {
      throw new Error('CLICKPESA_CLIENT_ID or CLICKPESA_API_KEY is missing');
    }

    // ✅ Hosted mode uses /third-parties/generate-token (token already includes "Bearer ")
    const res = await fetch(`${BASE_URL}/third-parties/generate-token`, {
      method: 'POST',
      headers: {
        'client-id': CLIENT_ID,
        'api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Token generation failed (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    console.log('[ClickPesa] Token response:', data);

    const token = data.token || data.accessToken || data.access_token;

    if (!token) {
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

    // ✅ Hosted mode payload format
    const payload = {
      totalPrice: params.amount.toString(),
      orderReference: params.orderReference,
      orderCurrency: 'TZS',
      customerName: params.customerName || '',
      customerEmail: params.customerEmail || '',
      customerPhone: params.customerPhone || '',
      description: params.description || '',
      callbackUrl: WEBHOOK_URL,
      redirectUrl: `${APP_URL}/payment/success`,
    };

    console.log('[ClickPesa] Checkout payload:', JSON.stringify(payload, null, 2));

    // ✅ Hosted mode endpoint
    const res = await fetch(`${BASE_URL}/checkout-link/generate-checkout-url`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    console.log('[ClickPesa] Checkout response:', responseText);

    if (!res.ok) {
      throw new Error(`ClickPesa checkout error (${res.status}): ${responseText}`);
    }

    const data = JSON.parse(responseText);
    
    // ✅ Hosted mode returns checkoutLink
    const checkoutUrl = data.checkoutLink || data.checkoutUrl || data.checkout_url;
    const orderId = data.orderId || data.order_id || data.id;

    if (!checkoutUrl) {
      throw new Error(`No checkout URL returned: ${JSON.stringify(data)}`);
    }

    return { checkoutUrl, orderId };
  } catch (error) {
    console.error('[ClickPesa] Generate checkout error:', error);
    throw error;
  }
}