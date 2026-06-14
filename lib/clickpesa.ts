// lib/clickpesa.ts

const CLIENT_ID = process.env.CLICKPESA_CLIENT_ID!;
const API_KEY = process.env.CLICKPESA_API_KEY!;
const BASE_URL = process.env.CLICKPESA_BASE_URL!;
const WEBHOOK_URL = process.env.CLICKPESA_WEBHOOK_URL;

export async function getAccessToken(): Promise<string> {
  const res = await fetch(`${BASE_URL}/generate-token`, {
    method: 'POST',
    headers: {
      'client-id': CLIENT_ID,
      'api-key': API_KEY,
    },
  });
  if (!res.ok) {
    throw new Error('Failed to generate ClickPesa token');
  }
  const data = await res.json();
  // token already includes the "Bearer " prefix
  return data.token;
}

export async function generateCheckoutLink(params: {
  amount: number;
  orderReference: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
}): Promise<{ checkoutUrl: string }> {
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
  };

  const res = await fetch(`${BASE_URL}/checkout-link/generate-checkout-url`, {
    method: 'POST',
    headers: {
      Authorization: token,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ClickPesa checkout error: ${errorText}`);
  }

  const data = await res.json();
  if (!data.checkoutLink) {
    throw new Error(`ClickPesa did not return checkoutLink: ${JSON.stringify(data)}`);
  }
  return { checkoutUrl: data.checkoutLink };
}