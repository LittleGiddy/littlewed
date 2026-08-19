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
  // ✅ Using the /multi endpoint (which also works for single messages)
  const fullUrl = `${SMS_API_URL}/api/sms/v2/text/multi`;
  
  console.log('[SMS] Sending to:', cleanTo);
  console.log('[SMS] URL:', fullUrl);
  console.log('[SMS] Sender:', SMS_SENDER_ID);

  try {
    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${SMS_API_KEY}`,
      },
      body: JSON.stringify({
        messages: [
          {
            from: SMS_SENDER_ID,
            to: cleanTo,
            text: message,
          }
        ],
        // Optional: Add reference for tracking
        reference: `invitation_${Date.now()}`,
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
        console.error('[SMS] ❌ Authentication failed - Check API key');
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

    // Get messageId from the response
    const messageId = data.messages?.[0]?.messageId || 
                      data.messageId || 
                      data.id || 
                      `sms_${Date.now()}`;

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