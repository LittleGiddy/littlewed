// lib/clickpesa.ts

const API_KEY = process.env.CLICKPESA_API_KEY!;
const API_SECRET = process.env.CLICKPESA_API_SECRET!;
const BASE_URL = process.env.CLICKPESA_BASE_URL!;
const WEBHOOK_URL = process.env.CLICKPESA_WEBHOOK_URL;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

// ─── Get Access Token ────────────────────────────────────────────────────
export async function getAccessToken(): Promise<string> {
  try {
    const res = await fetch(`${BASE_URL}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: API_KEY,
        api_secret: API_SECRET,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('[ClickPesa] Token error:', errorText);
      throw new Error(`Failed to generate ClickPesa token: ${errorText}`);
    }

    const data = await res.json();
    console.log('[ClickPesa] Token response:', data);
    
    const token = data.access_token || data.token;
    
    if (!token) {
      console.error('[ClickPesa] No token in response:', data);
      throw new Error('No token returned from ClickPesa');
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
      amount: params.amount,
      order_reference: params.orderReference,
      currency: 'TZS',
      customer_name: params.customerName || '',
      customer_email: params.customerEmail || '',
      customer_phone: params.customerPhone || '',
      description: params.description || `Purchase ${params.amount} TZS credits`,
      callback_url: WEBHOOK_URL,
      success_url: `${APP_URL}/payment/success`,
      failure_url: `${APP_URL}/payment/failure`,
      metadata: {
        order_reference: params.orderReference,
        amount: params.amount,
      },
    };

    console.log('[ClickPesa] Creating payment:', {
      orderReference: params.orderReference,
      amount: params.amount,
      callbackUrl: WEBHOOK_URL,
    });

    const res = await fetch(`${BASE_URL}/payments`, {
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

    // Handle different response formats
    const checkoutUrl = data.data?.checkout_url || 
                       data.data?.checkoutLink || 
                       data.data?.payment_link || 
                       data.data?.redirect_url ||
                       data.checkout_url ||
                       data.checkoutLink ||
                       data.payment_link ||
                       data.redirect_url;
    
    const orderId = data.data?.order_id || 
                   data.data?.id || 
                   data.order_id || 
                   data.id;

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

// ─── Verify Webhook Signature ─────────────────────────────────────────────
export function verifyWebhookSignature(
  payload: any,
  signature: string,
  secret: string = process.env.CLICKPESA_WEBHOOK_SECRET!
): boolean {
  try {
    if (!secret) {
      console.warn('[ClickPesa] No webhook secret configured - skipping signature verification');
      return true;
    }

    const crypto = require('crypto');
    
    // Try SHA256
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    if (signature === expectedSignature) {
      return true;
    }
    
    // Try SHA512 if SHA256 fails
    const expectedSignature512 = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return signature === expectedSignature512;
  } catch (error) {
    console.error('[ClickPesa] Signature verification error:', error);
    return false;
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

    const responseText = await res.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      throw new Error(`ClickPesa returned invalid JSON: ${responseText}`);
    }

    console.log('[ClickPesa] Payment verification response:', data);

    const paymentData = data.data || data;
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
      status: statusMap[paymentData.status] || 'pending',
      amount: paymentData.amount || paymentData.total_price,
      transactionId: paymentData.transaction_id || paymentData.id,
    };
  } catch (error) {
    console.error('[ClickPesa] Verify payment error:', error);
    throw error;
  }
}