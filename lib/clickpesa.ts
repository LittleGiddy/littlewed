// lib/clickpesa.ts - Full API Integration with custom payment page

const CLIENT_ID = process.env.CLICKPESA_CLIENT_ID!;
const API_KEY = process.env.CLICKPESA_API_KEY!;
const BASE_URL = process.env.CLICKPESA_BASE_URL || 'https://api.clickpesa.com';
const WEBHOOK_URL = process.env.CLICKPESA_WEBHOOK_URL;

// ─── Get Access Token ────────────────────────────────────────────────────
export async function getAccessToken(): Promise<string> {
  try {
    if (!CLIENT_ID || !API_KEY) {
      throw new Error('CLICKPESA_CLIENT_ID or CLICKPESA_API_KEY is missing');
    }

    const res = await fetch(`${BASE_URL}/generate-token`, {
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

// ─── Create Payment Intent ──────────────────────────────────────────────
export async function createPaymentIntent(params: {
  amount: number;
  orderReference: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  description?: string;
}): Promise<{ 
  paymentId: string; 
  clientSecret?: string;
  status: 'pending' | 'requires_action' | 'succeeded';
}> {
  try {
    const token = await getAccessToken();

    const payload = {
      amount: params.amount,
      currency: 'TZS',
      order_reference: params.orderReference,
      customer: {
        name: params.customerName,
        email: params.customerEmail,
        phone: params.customerPhone,
      },
      description: params.description || 'Credit purchase',
      callback_url: WEBHOOK_URL,
      metadata: {
        order_reference: params.orderReference,
        amount: params.amount,
      },
    };

    console.log('[ClickPesa] Creating payment intent:', JSON.stringify(payload, null, 2));

    const res = await fetch(`${BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    console.log('[ClickPesa] Payment intent response:', responseText);

    if (!res.ok) {
      throw new Error(`Payment intent failed (${res.status}): ${responseText}`);
    }

    const data = JSON.parse(responseText);
    
    return {
      paymentId: data.id || data.payment_id,
      clientSecret: data.client_secret || data.clientSecret,
      status: data.status || 'pending',
    };
  } catch (error) {
    console.error('[ClickPesa] Create payment intent error:', error);
    throw error;
  }
}

// ─── Confirm Payment ──────────────────────────────────────────────────────
export async function confirmPayment(params: {
  paymentId: string;
  paymentMethod: 'mpesa' | 'airtel_money' | 'tigo_pesa' | 'halopesa' | 'card' | 'bank';
  phoneNumber?: string;
  cardDetails?: {
    number: string;
    expiryMonth: string;
    expiryYear: string;
    cvc: string;
  };
}): Promise<{ 
  status: 'succeeded' | 'failed' | 'pending';
  transactionId?: string;
}> {
  try {
    const token = await getAccessToken();

    const payload: any = {
      payment_method: params.paymentMethod,
    };

    if (params.phoneNumber) {
      payload.phone_number = params.phoneNumber;
    }

    if (params.cardDetails) {
      payload.card = {
        number: params.cardDetails.number,
        expiry_month: params.cardDetails.expiryMonth,
        expiry_year: params.cardDetails.expiryYear,
        cvc: params.cardDetails.cvc,
      };
    }

    console.log('[ClickPesa] Confirming payment:', JSON.stringify(payload, null, 2));

    const res = await fetch(`${BASE_URL}/payments/${params.paymentId}/confirm`, {
      method: 'POST',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await res.text();
    console.log('[ClickPesa] Confirm payment response:', responseText);

    if (!res.ok) {
      throw new Error(`Payment confirmation failed (${res.status}): ${responseText}`);
    }

    const data = JSON.parse(responseText);
    
    return {
      status: data.status || 'pending',
      transactionId: data.transaction_id || data.transactionId,
    };
  } catch (error) {
    console.error('[ClickPesa] Confirm payment error:', error);
    throw error;
  }
}

// ─── Get Payment Status ──────────────────────────────────────────────────
export async function getPaymentStatus(paymentId: string): Promise<{
  status: 'pending' | 'succeeded' | 'failed';
  amount?: number;
  transactionId?: string;
}> {
  try {
    const token = await getAccessToken();

    const res = await fetch(`${BASE_URL}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: token,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Get payment failed (${res.status}): ${errorText}`);
    }

    const data = await res.json();
    
    return {
      status: data.status || 'pending',
      amount: data.amount,
      transactionId: data.transaction_id || data.transactionId,
    };
  } catch (error) {
    console.error('[ClickPesa] Get payment status error:', error);
    throw error;
  }
}