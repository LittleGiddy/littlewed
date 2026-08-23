// lib/clickpesa.ts

const CLIENT_ID = process.env.CLICKPESA_CLIENT_ID!;
const API_KEY = process.env.CLICKPESA_API_KEY!;
const BASE_URL = process.env.CLICKPESA_BASE_URL!;
const WEBHOOK_URL = process.env.CLICKPESA_WEBHOOK_URL;

// ─── Get Access Token ────────────────────────────────────────────────────
export async function getAccessToken(): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/generate-token`, {
      method: 'POST',
      headers: {
        'client-id': CLIENT_ID,
        'api-key': API_KEY,
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[ClickPesa] Token error:', errorText);
      throw new Error(`Failed to generate ClickPesa token: ${errorText}`);
    }

    const data = await res.json();
    console.log('[ClickPesa] Token response:', data);
    
    // Token already includes the "Bearer " prefix
    const token = data.token;
    
    if (!token) {
      console.error('[ClickPesa] No token in response:', data);
      throw new Error('No token returned from ClickPesa');
    }

    // Ensure token has Bearer prefix if not already
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
      redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/client/dashboard`,
    };

    console.log('[ClickPesa] Creating payment:', {
      orderReference: params.orderReference,
      amount: params.amount,
      callbackUrl: WEBHOOK_URL,
    });

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
    
    if (!res.ok) {
      console.error('[ClickPesa] Checkout error:', responseText);
      throw new Error(`ClickPesa checkout error: ${responseText}`);
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`ClickPesa returned invalid JSON: ${responseText}`);
    }

    console.log('[ClickPesa] Checkout response:', data);

    // Check for checkoutLink in response
    const checkoutUrl = data.checkoutLink || data.checkoutUrl || data.checkout_url;
    const orderId = data.orderId || data.order_id || data.id;

    if (!checkoutUrl) {
      console.error('[ClickPesa] No checkout URL in response:', data);
      throw new Error(`ClickPesa did not return a checkout URL: ${JSON.stringify(data)}`);
    }

    return { 
      checkoutUrl,
      orderId,
    };
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

    const res = await fetch(`${BASE_URL}/payments/${orderReference}`, {
      method: 'GET',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[ClickPesa] Verify payment error:', errorText);
      throw new Error(`Failed to verify payment: ${errorText}`);
    }

    const data = await res.json();
    console.log('[ClickPesa] Payment verification response:', data);

    const statusMap: Record<string, 'completed' | 'pending' | 'failed'> = {
      'completed': 'completed',
      'success': 'completed',
      'SUCCESS': 'completed',
      'COMPLETED': 'completed',
      'pending': 'pending',
      'PENDING': 'pending',
      'failed': 'failed',
      'FAILED': 'failed',
      'cancelled': 'failed',
      'CANCELLED': 'failed',
    };

    return {
      status: statusMap[data.status] || 'pending',
      amount: data.amount || data.totalPrice,
      transactionId: data.transactionId || data.id,
    };
  } catch (error) {
    console.error('[ClickPesa] Verify payment error:', error);
    throw error;
  }
}