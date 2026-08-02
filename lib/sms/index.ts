// lib/sms/index.ts

const API_KEY = process.env.NEXT_SMS_API_KEY!;
const SENDER_ID = process.env.NEXT_SMS_SENDER_ID!;
const BASE_URL = process.env.NEXT_SMS_BASE_URL!; // e.g., https://api.nextsms.co.tz/api/v1

export interface SendSMSOptions {
  to: string;          // phone number in international format (e.g., 2557xxxxxxxx)
  message: string;
  sender?: string;     // optional, falls back to SENDER_ID
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
        'Authorization': `Bearer ${API_KEY}`, // ✅ Bearer token authentication
      },
      body: JSON.stringify({
        sender,
        to,
        message,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || data.error || 'Failed to send SMS');
    }

    return {
      success: true,
      messageId: data.messageId || data.id,
    };
  } catch (error: any) {
    console.error('[NextSMS] Error sending SMS:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}