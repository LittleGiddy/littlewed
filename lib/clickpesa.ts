// lib/clickpesa.ts

const CLIENT_ID = process.env.CLICKPESA_CLIENT_ID!;
const API_KEY = process.env.CLICKPESA_API_KEY!;
// ClickPesa's documented base for both generate-token and checkout-link is
// https://api.clickpesa.com/third-parties — make that the default, not just
// the root host, so a missing env var doesn't silently break every request.
const BASE_URL = process.env.CLICKPESA_BASE_URL || 'https://api.clickpesa.com/third-parties';
const WEBHOOK_URL = process.env.CLICKPESA_WEBHOOK_URL;

// Small helper so we can confirm creds are actually loaded (and not
// whitespace / truncated / stale) without ever printing the real values.
function mask(value: string | undefined, label: string) {
  if (!value) return `[${label} MISSING]`;
  const trimmed = value.trim();
  const hadWhitespace = trimmed !== value;
  return `[${label} len=${value.length}${hadWhitespace ? ' ⚠️ has leading/trailing whitespace' : ''} starts="${trimmed.slice(0, 4)}..." ends="...${trimmed.slice(-4)}"]`;
}

// ─── Get Access Token ────────────────────────────────────────────────────
export async function getAccessToken(): Promise<string> {
  try {
    console.log('[ClickPesa] Getting token...');
    console.log('[ClickPesa] BASE_URL:', BASE_URL);
    console.log('[ClickPesa] CLIENT_ID:', mask(CLIENT_ID, 'CLIENT_ID'));
    console.log('[ClickPesa] API_KEY:', mask(API_KEY, 'API_KEY'));

    if (!CLIENT_ID || !API_KEY) {
      throw new Error('CLICKPESA_CLIENT_ID or CLICKPESA_API_KEY is missing');
    }

    const url = `${BASE_URL}/generate-token`;
    console.log('[ClickPesa] POST', url);

    const res = await fetch(url, {
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
    console.log('[ClickPesa] Token response content-type:', res.headers.get('content-type'));
    console.log('[ClickPesa] Token response body (raw):', responseText);

    if (!res.ok) {
      // Per ClickPesa docs: 401 = missing credentials, 403 = invalid client
      // details / invalid or expired API key / unauthorized API key.
      throw new Error(`Token generation failed (${res.status}): ${responseText}`);
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      // A 200 that isn't valid JSON usually means we hit a proxy/host that
      // isn't the ClickPesa API at all (wrong BASE_URL, gateway error page,
      // HTML from a redirect, etc).
      console.error('[ClickPesa] Response was not valid JSON. This usually means BASE_URL is wrong or a proxy intercepted the request.');
      throw new Error(`ClickPesa returned non-JSON response: ${responseText.slice(0, 300)}`);
    }

    console.log('[ClickPesa] Token response parsed:', { success: data.success, hasToken: !!data.token });

    // Per the documented contract, a 200 always includes { success, token }.
    // Checking a couple of alternate field names defensively in case that
    // ever changes, but data.token is what should actually be there.
    const token = data.token || data.accessToken || data.access_token;

    if (!token) {
      console.error('[ClickPesa] No token in response body:', JSON.stringify(data));
      throw new Error(`No token returned: ${JSON.stringify(data)}`);
    }

    console.log('[ClickPesa] Token obtained successfully, valid for 1 hour');

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
  returnUrl?: string;
}): Promise<{ checkoutUrl: string; orderId?: string }> {
  try {
    const token = await getAccessToken();

    if (!WEBHOOK_URL) {
      // Not fatal, but this is the #1 cause of "payment succeeds on
      // ClickPesa's side but never completes in our app" — flag it loudly.
      console.warn('[ClickPesa] ⚠️ CLICKPESA_WEBHOOK_URL is not set — ClickPesa will have no way to notify this app when payment completes.');
    }

    const payload = {
      totalPrice: params.amount.toString(),
      orderReference: params.orderReference,
      orderCurrency: 'TZS',
      customerName: params.customerName || '',
      customerEmail: params.customerEmail || '',
      customerPhone: params.customerPhone || '',
      description: params.description || '',
      callbackUrl: WEBHOOK_URL,
      redirectUrl: params.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL}/client/dashboard`,
    };

    console.log('[ClickPesa] Checkout payload:', JSON.stringify(payload, null, 2));

    const url = `${BASE_URL}/checkout-link/generate-checkout-url`;
    console.log('[ClickPesa] POST', url);

    const res = await fetch(url, {
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
    console.log('[ClickPesa] Checkout response content-type:', res.headers.get('content-type'));
    console.log('[ClickPesa] Checkout response body (raw):', responseText);

    if (!res.ok) {
      throw new Error(`ClickPesa checkout error (${res.status}): ${responseText}`);
    }

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('[ClickPesa] Checkout response was not valid JSON. This usually means BASE_URL is wrong or a proxy intercepted the request.');
      throw new Error(`ClickPesa returned non-JSON response: ${responseText.slice(0, 300)}`);
    }

    const checkoutUrl = data.checkoutLink || data.checkoutUrl || data.checkout_url;
    const orderId = data.orderId || data.order_id || data.id;

    if (!checkoutUrl) {
      console.error('[ClickPesa] No checkout URL in response:', JSON.stringify(data));
      throw new Error(`No checkout URL returned: ${JSON.stringify(data)}`);
    }

    return { checkoutUrl, orderId };
  } catch (error) {
    console.error('[ClickPesa] Generate checkout error:', error);
    throw error;
  }
}

// ─── Verify Payment Status ────────────────────────────────────────────────
export async function verifyPaymentStatus(orderReference: string): Promise<{
  status: 'completed' | 'pending' | 'failed';
  amount?: number;
  transactionId?: string;
}> {
  try {
    const token = await getAccessToken();

    const url = `${BASE_URL}/payments/${orderReference}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    const responseText = await res.text();
    console.log('[ClickPesa] Verify status response:', res.status, responseText);

    if (!res.ok) {
      throw new Error(`Failed to verify payment (${res.status}): ${responseText}`);
    }

    const data = JSON.parse(responseText);

    const statusMap: Record<string, 'completed' | 'pending' | 'failed'> = {
      completed: 'completed',
      success: 'completed',
      SUCCESS: 'completed',
      COMPLETED: 'completed',
      SETTLED: 'completed',
      pending: 'pending',
      PENDING: 'pending',
      PROCESSING: 'pending',
      failed: 'failed',
      FAILED: 'failed',
      cancelled: 'failed',
      CANCELLED: 'failed',
    };

    return {
      status: statusMap[data.status] || 'pending',
      amount: data.amount || data.totalPrice || data.collectedAmount,
      transactionId: data.transactionId || data.id,
    };
  } catch (error) {
    console.error('[ClickPesa] Verify payment error:', error);
    throw error;
  }
}