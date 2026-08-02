// lib/sms/index.ts

const API_KEY = process.env.NEXT_SMS_API_KEY!;
const SENDER_ID = process.env.NEXT_SMS_SENDER_ID!;
const BASE_URL = process.env.NEXT_SMS_BASE_URL!; // e.g., https://api.nextsms.co.tz/api/v1

export interface SendSMSOptions {
  to: string;          // phone number without + (e.g., 255769999902)
  message: string;
  sender?: string;     // optional, falls back to SENDER_ID
  flash?: 0 | 1;       // 0 = normal, 1 = flash message
  reference?: string;  // optional reference ID
}

export async function sendSMS({ to, message, sender = SENDER_ID, flash = 0, reference }: SendSMSOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (!API_KEY) {
    throw new Error('NEXT_SMS_API_KEY is not set');
  }

  // Generate a random reference if not provided
  const ref = reference || `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    const response = await fetch(`${BASE_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${API_KEY}`, // ✅ as used in Postman
      },
      body: JSON.stringify({
        from: sender,
        to: to,
        text: message,
        flash: flash,
        reference: ref,
      }),
    });

    // Handle non‑JSON responses (unlikely with correct headers)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[NextSMS] Non-JSON response:', {
        status: response.status,
        body: text.slice(0, 200),
      });
      throw new Error(`Server returned non-JSON (${response.status})`);
    }

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.message || data.error || `HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    // Extract message ID from response – adapt to your API's structure
    const messageId = data.data?.messageId || data.messageId || data.id || ref;

    return {
      success: true,
      messageId: messageId,
    };
  } catch (error: any) {
    console.error('[NextSMS] Error sending SMS:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}