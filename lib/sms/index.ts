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
        loggedMessage: message,
        to,
      },
    };
  }

  // Clean phone number (remove + and non-numeric)
  const cleanTo = to.replace(/^\+/, '').replace(/\D/g, '');

  // ─── Build the correct API URL ──────────────────────────────────────
  // This is the URL that was working in the reminder system
  const fullUrl = `${SMS_API_URL}/api/sms/v2/text/single`;
  
  console.log('[SMS] Sending to:', cleanTo);
  console.log('[SMS] URL:', fullUrl);
  console.log('[SMS] Sender:', SMS_SENDER_ID);

  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SMS_API_KEY}`,
      },
      body: JSON.stringify({
        from: SMS_SENDER_ID,
        to: cleanTo,
        text: message,
      }),
    });

    // ─── Check if response is JSON ──────────────────────────────────────
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[SMS] ❌ Non-JSON response:', text.substring(0, 200));
      
      if (text.includes('<!DOCTYPE') || text.includes('<html')) {
        return {
          success: false,
          error: 'SMS API returned HTML error page. Please check API configuration.',
          data: { htmlResponse: text.substring(0, 500) },
        };
      }
      
      return {
        success: false,
        error: `SMS API returned non-JSON response: ${text.substring(0, 100)}`,
        data: { text },
      };
    }

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
    console.error('[SMS] ❌ Error sending SMS:', error.message);
    return { 
      success: false, 
      error: error.message || 'Network error',
    };
  }
}