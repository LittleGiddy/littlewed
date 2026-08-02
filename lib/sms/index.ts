// lib/sms/index.ts

const API_KEY = process.env.NEXT_SMS_API_KEY!;
const SENDER_ID = process.env.NEXT_SMS_SENDER_ID!;
const BASE_URL = process.env.NEXT_SMS_BASE_URL!; // e.g., https://api.nextsms.co.tz/api/v1

export interface SendSMSOptions {
  to: string;
  message: string;
  sender?: string;
}

export async function sendSMS({ to, message, sender = SENDER_ID }: SendSMSOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!API_KEY) {
    throw new Error('NEXT_SMS_API_KEY is not set');
  }

  try {
    const response = await fetch(`${BASE_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        sender,
        to,
        message,
      }),
    });

    // ─── Check if response is JSON ──────────────────────────────────────
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      // If the response is HTML (e.g., error page), throw with details
      const text = await response.text();
      console.error('[NextSMS] Non-JSON response:', {
        status: response.status,
        statusText: response.statusText,
        body: text.slice(0, 200), // log first 200 chars to avoid huge logs
      });
      throw new Error(`Server returned non-JSON (${response.status}). Check your API URL and key.`);
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || `HTTP ${response.status}`);
    }

    return {
      success: true,
      messageId: data.messageId || data.id || data.data?.id,
    };
  } catch (error: any) {
    console.error('[NextSMS] Error sending SMS:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}