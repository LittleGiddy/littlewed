// lib/sms/index.ts

const API_KEY = process.env.NEXT_SMS_API_KEY!;
const SENDER_ID = process.env.NEXT_SMS_SENDER_ID!;
const BASE_URL = process.env.NEXT_SMS_BASE_URL! || 'https://messaging-service.co.tz/api/sms/v2';

export interface SendSMSOptions {
  to: string;
  message: string;
  sender?: string;
  flash?: 0 | 1;
  reference?: string;
}

export async function sendSMS({ to, message, sender = SENDER_ID, flash = 0, reference }: SendSMSOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!API_KEY) {
    throw new Error('NEXT_SMS_API_KEY is not set');
  }

  const endpoint = `${BASE_URL}/text/single`;
  const ref = reference || `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Remove leading '+' from phone number
  const cleanTo = to.replace(/^\+/, '');

  console.log('[SMS] Sending to:', endpoint);
  console.log('[SMS] Payload:', { from: sender, to: cleanTo, text: message, flash, reference: ref });

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        from: sender,
        to: cleanTo,
        text: message,
        flash,
        reference: ref,
      }),
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[SMS] Non-JSON response:', {
        status: response.status,
        body: text.slice(0, 500),
      });
      throw new Error(`Server returned non-JSON (${response.status}).`);
    }

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.message || data.error || `HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    const messageId = data.data?.messageId || data.messageId || data.id || ref;

    return { success: true, messageId };
  } catch (error: any) {
    console.error('[SMS] Error sending SMS:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}