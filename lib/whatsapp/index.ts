// lib/whatsapp/index.ts

const NEXTSMS_TOKEN = process.env.NEXTSMS_TOKEN!;
const NEXTSMS_ACCOUNT = process.env.NEXTSMS_ACCOUNT! || 'LittleWed by Mahiri Global Limited';
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
    return { success: false, error: 'NEXTSMS_TOKEN is not set' };
  }

  const toArray = Array.isArray(to) ? to : [to];
  const cleanTo = toArray.map(phone => parseInt(phone.replace(/^\+/, '').replace(/\D/g, '')));

  const body: any = {
    to: cleanTo,
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
  console.log('[WhatsApp] To:', cleanTo);
  console.log('[WhatsApp] Payload:', JSON.stringify(body, null, 2));

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

    console.log('[WhatsApp] Response Status:', response.status);
    console.log('[WhatsApp] Response Data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      let errorMsg = data.message || data.error || `HTTP ${response.status}`;
      
      if (response.status === 400) {
        console.error('[WhatsApp] ❌ Bad Request - Check template name and variables');
        console.error('[WhatsApp] Template:', template);
        console.error('[WhatsApp] Variables:', JSON.stringify(personalisation, null, 2));
        
        if (data.errors) {
          console.error('[WhatsApp] Error Details:', JSON.stringify(data.errors, null, 2));
          if (Array.isArray(data.errors)) {
            errorMsg = data.errors.map((e: any) => e.message || e).join(', ');
          } else if (typeof data.errors === 'object') {
            errorMsg = JSON.stringify(data.errors);
          } else {
            errorMsg = String(data.errors);
          }
        }
      } else if (response.status === 401) {
        console.error('[WhatsApp] ❌ Authentication failed - Check NEXTSMS_TOKEN');
        errorMsg = 'Authentication failed. Please check your API token.';
      } else if (response.status === 429) {
        console.error('[WhatsApp] ❌ Rate limit exceeded - Too many messages');
        errorMsg = 'Rate limit exceeded. Please wait and try again.';
      } else if (response.status === 403) {
        console.error('[WhatsApp] ❌ Forbidden - Template might not be approved');
        errorMsg = 'Template not approved or account restricted.';
      }
      
      return { success: false, error: errorMsg, data };
    }

    console.log('[WhatsApp] ✅ Message accepted by NexSMS');
    
    const messageId = data.messages?.[0]?.messageId || data.data?.messageId || data.messageId || data.id;

    return { success: true, messageId: String(messageId), data };
  } catch (error: any) {
    console.error('[WhatsApp] ❌ Error sending template:', error.message);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// ─── Wedding Invitation Template ──────────────────────────────────────

export async function sendWeddingInvitation(
  phone: string,
  data: {
    guestName: string;
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
  console.log('[WhatsApp] Template: swahili_invitation');

  // ─── Header with image ────────────────────────────────────────────────
  const header = {
    image: {
      file: data.imageUrl || 'https://www.gstatic.com/webp/gallery/1.png',
      name: 'Wedding Invitation',
    }
  };

  // ─── Button with dynamic URL ──────────────────────────────────────────
  let button = undefined;
  if (data.inviteLink) {
    const slug = toLinkSuffix(data.inviteLink);
    button = {
      personalisation: {
        url_link: {
          parameters: [slug],
        },
      },
    };
  }

  // ─── Send template with proper variable mapping ──────────────────────
  // IMPORTANT: Match the exact case from your template:
  // var1, var2, var3, var4, var5, var6, var7, Var8 (capital V), var9
  return sendWhatsAppTemplate({
    to: phone,
    template: 'swahili_invitation', // ⚠️ Replace with your exact template name
    personalisation: [
      {
        "var1": data.guestName,      // ✅ Habari {var1}
        "var2": data.hostFamily,     // ✅ Familia ya {var2}
        "var3": data.person1,        // ✅ {var3}
        "var4": data.person2,        // ✅ {var4}
        "var5": data.date,           // ✅ {var5}
        "var6": data.venue,          // ✅ {var6}
        "var7": data.time,           // ✅ {var7}
        "Var8": data.cardNumber,     // ✅ {Var8} - CAPITAL V!
        "var9": data.cardType,       // ✅ {var9}
      }
    ],
    header,
    button,
  });
}

// ─── Helper: Convert full URL to slug ──────────────────────────────────

export function toLinkSuffix(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || value;
  } catch {
    return value;
  }
}