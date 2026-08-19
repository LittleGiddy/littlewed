// lib/sms/index.ts

const SMS_API_KEY = process.env.NEXT_SMS_API_KEY;
const SMS_SENDER_ID = process.env.NEXT_SMS_SENDER_ID || 'MAHIRI LTD';
const SMS_API_URL = process.env.NEXT_SMS_BASE_URL || 'https://messaging-service.co.tz';

export interface SendSMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  data?: any;
}

export async function sendSMS({
  to,
  message,
}: {
  to: string;
  message: string;
}): Promise<SendSMSResult> {
  // ─── Check if API key is configured ──────────────────────────────────
  if (!SMS_API_KEY) {
    console.warn('[SMS] ⚠️ NEXT_SMS_API_KEY is not set. SMS messages will be logged only.');
    console.log('[SMS] To:', to);
    console.log('[SMS] Message:', message);
    
    return {
      success: true,
      messageId: `sms_${Date.now()}`,
      data: { 
        simulated: true, 
        loggedMessage: message, // ✅ Changed from 'message' to 'loggedMessage'
        to,
      },
    };
  }

  // Clean phone number (remove + and non-numeric)
  const cleanTo = to.replace(/^\+/, '').replace(/\D/g, '');

  try {
    const response = await fetch(SMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SMS_API_KEY}`,
      },
      body: JSON.stringify({
        to: cleanTo,
        from: SMS_SENDER_ID,
        message: message,
      }),
    });

    const data = await response.json();

    console.log('[SMS] Response Status:', response.status);
    console.log('[SMS] Response Data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      let errorMsg = data.message || data.error || `HTTP ${response.status}`;
      
      if (response.status === 400) {
        console.error('[SMS] ❌ Bad Request - Check phone number and message');
        errorMsg = data.errors?.map((e: any) => e.message || e).join(', ') || errorMsg;
      } else if (response.status === 401) {
        console.error('[SMS] ❌ Authentication failed - Check NEXT_SMS_API_KEY');
        errorMsg = 'Authentication failed. Please check your API key.';
      } else if (response.status === 429) {
        console.error('[SMS] ❌ Rate limit exceeded - Too many messages');
        errorMsg = 'Rate limit exceeded. Please wait and try again.';
      }
      
      return { 
        success: false, 
        error: errorMsg,
        data: data,
      };
    }

    const messageId = data.messageId || data.id || data.message_id || `sms_${Date.now()}`;

    return { 
      success: true, 
      messageId: String(messageId),
      data: data,
    };
  } catch (error: any) {
    console.error('[SMS] Error sending SMS:', error.message);
    return { 
      success: false, 
      error: error.message || 'Network error',
    };
  }
}