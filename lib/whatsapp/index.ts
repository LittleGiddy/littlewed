// lib/whatsapp/index.ts

const NEXTSMS_TOKEN = process.env.NEXTSMS_TOKEN!;
const NEXTSMS_ACCOUNT = process.env.NEXTSMS_ACCOUNT! || 'LittleWed by Mahiri Ltd';
const NEXTSMS_API_URL = 'https://messaging-service.co.tz/api/whatsapp/v2/text/single';

export interface SendWhatsAppTemplateOptions {
  to: string | string[];
  template: string;
  personalisation?: Record<string, string>[];
  header?: {
    image?: { file: string; name?: string };
    document?: { file: string; name?: string };
  };
  button?: {
    personalisation: {
      url_link: {
        parameters: string[];
      };
    };
  };
}

export interface SendWhatsAppResult {
  success: boolean;
  messageId?: string;
  error?: string;
  data?: any;
}

export async function sendWhatsAppTemplate({
  to,
  template,
  personalisation,
  header,
  button,
}: SendWhatsAppTemplateOptions): Promise<SendWhatsAppResult> {
  if (!NEXTSMS_TOKEN) {
    throw new Error('NEXTSMS_TOKEN is not set');
  }

  // ─── Convert to array and CLEAN phone numbers for WhatsApp ──────────
  const toArray = Array.isArray(to) ? to : [to];
  
  // ✅ FIX: Remove '+' and any non-digit characters, then convert to number
  // WhatsApp API expects: [255769999902] NOT [+255769999902]
  const cleanTo = toArray.map(phone => {
    const cleaned = String(phone).replace(/^\+/, '').replace(/\D/g, '');
    return parseInt(cleaned);
  });

  console.log('[WhatsApp] Original numbers:', toArray);
  console.log('[WhatsApp] Clean numbers (no +):', cleanTo);

  const body: any = {
    to: cleanTo, // ✅ Now sending: [255769999902] instead of [+255769999902]
    account: NEXTSMS_ACCOUNT,
    template: template,
  };

  if (personalisation) {
    body.personalisation = personalisation;
  }

  if (header) {
    body.header = header;
  }

  if (button) {
    body.button = button;
  }

  console.log('[WhatsApp] ====== SENDING MESSAGE ======');
  console.log('[WhatsApp] Template:', template);
  console.log('[WhatsApp] Account:', NEXTSMS_ACCOUNT);
  console.log('[WhatsApp] To (clean):', cleanTo);
  console.log('[WhatsApp] Full Payload:', JSON.stringify(body, null, 2));

  try {
    const response = await fetch(NEXTSMS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${NEXTSMS_TOKEN}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    // ─── Detailed logging ──────────────────────────────────────────────
    console.log('[WhatsApp] Response Status:', response.status);
    console.log('[WhatsApp] Response Data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      // ─── Parse error details ─────────────────────────────────────────
      let errorMsg = data.message || data.error || `HTTP ${response.status}`;
      
      // Check for specific error types
      if (data.errors) {
        console.error('[WhatsApp] Error Details:', JSON.stringify(data.errors, null, 2));
        
        if (data.errors.template) {
          console.error('[WhatsApp] Template Error:', data.errors.template);
        }
        if (data.errors.to) {
          console.error('[WhatsApp] Phone Number Error:', data.errors.to);
        }
        if (data.errors.account) {
          console.error('[WhatsApp] Account Error:', data.errors.account);
        }
      }

      // ─── Check for specific failure reasons ─────────────────────────
      if (errorMsg.includes('template')) {
        console.error('[WhatsApp] ❌ Template issue - check if template is approved and variables match');
      }
      if (errorMsg.includes('phone') || errorMsg.includes('to')) {
        console.error('[WhatsApp] ❌ Phone number issue - check format (should be without +)');
      }
      if (errorMsg.includes('account')) {
        console.error('[WhatsApp] ❌ Account issue - check NEXTSMS_ACCOUNT');
      }
      if (errorMsg.includes('verified') || errorMsg.includes('approved')) {
        console.error('[WhatsApp] ❌ Template not approved by Meta yet');
      }
      if (errorMsg.includes('business')) {
        console.error('[WhatsApp] ❌ Business verification issue - check Meta Business status');
      }

      throw new Error(errorMsg);
    }

    // ─── Success but check for delivery status ─────────────────────────
    console.log('[WhatsApp] ✅ Message accepted by NexSMS');
    console.log('[WhatsApp] Message ID:', data.data?.messageId || data.messageId || data.id);
    console.log('[WhatsApp] Status:', data.data?.status || data.status || 'PENDING');

    // ─── Save message ID to database (optional) ────────────────────────
    const messageId = data.data?.messageId || data.messageId || data.id;

    // If you want to save to database, uncomment and add prisma import
    // try {
    //   await prisma.messageLog.create({
    //     data: {
    //       messageId: String(messageId),
    //       type: 'WHATSAPP',
    //       template: template,
    //       status: 'SENT',
    //     },
    //   });
    // } catch (dbError) {
    //   console.warn('[WhatsApp] Failed to save MessageLog:', dbError);
    // }

    return { success: true, messageId: String(messageId), data };
  } catch (error: any) {
    console.error('[WhatsApp] ❌ Error sending template:', error.message);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

export async function sendWeddingInvitation(
  phone: string,
  data: {
    name: string;
    hostFamily: string;
    person1: string;
    person2: string;
    date: string;
    venue: string;
    time: string;
    cardNumber: string;
    cardType: string;
    imageUrl?: string;
    inviteLink?: string;
  }
): Promise<SendWhatsAppResult> {
  console.log('[WhatsApp] ====== SENDING WEDDING INVITATION ======');
  console.log('[WhatsApp] Phone (before clean):', phone);
  console.log('[WhatsApp] Name:', data.name);
  console.log('[WhatsApp] Host Family:', data.hostFamily);
  console.log('[WhatsApp] Event:', data.date, data.venue);
  console.log('[WhatsApp] Card:', data.cardNumber, data.cardType);

  const header = {
    image: {
      file: data.imageUrl || 'https://www.gstatic.com/webp/gallery/1.png',
      name: 'Wedding Invitation',
    }
  };

  const linkSuffix = data.inviteLink || 'default';
  console.log('[WhatsApp] Link Suffix:', linkSuffix);

  const result = await sendWhatsAppTemplate({
    to: phone, // ✅ Will be cleaned inside sendWhatsAppTemplate
    template: 'LittleWed',
    personalisation: [
      {
        "1": data.name,
        "2": data.hostFamily,
        "3": data.person1,
        "4": data.person2,
        "5": data.date,
        "6": data.venue,
        "7": data.time,
        "8": data.cardNumber,
        "9": data.cardType,
      }
    ],
    header,
    button: {
      personalisation: {
        url_link: {
          parameters: [linkSuffix],
        },
      },
    },
  });

  console.log('[WhatsApp] Result:', result.success ? '✅ Success' : '❌ Failed');
  if (!result.success) {
    console.log('[WhatsApp] Error:', result.error);
  }

  return result;
}

/**
 * Helper: Convert a full URL to just the suffix
 * e.g., "https://littlewed.co.tz/invite/abc123" → "abc123"
 */
export function toLinkSuffix(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || value;
  } catch {
    // Not a full URL — assume it's already a suffix
    return value;
  }
}