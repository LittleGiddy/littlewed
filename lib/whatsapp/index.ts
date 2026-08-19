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
      if (data.errors) {
        console.error('[WhatsApp] Error Details:', JSON.stringify(data.errors, null, 2));
        errorMsg = data.errors.map((e: any) => e.message || e).join(', ');
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
    guestName: string;      // var1: Guest name
    hostFamily: string;     // var2: Host family
    person1: string;        // var3: Person 1 (Groom)
    person2: string;        // var4: Person 2 (Bride)
    date: string;           // var5: Event date
    venue: string;          // var6: Venue
    time: string;           // var7: Time
    cardNumber: string;     // var8: Card number
    cardType: string;       // var9: Card type
    imageUrl?: string;      // Header image
    inviteLink?: string;    // Optional link for button
  }
): Promise<SendWhatsAppResult> {
  console.log('[WhatsApp] ====== SENDING WEDDING INVITATION ======');
  console.log('[WhatsApp] Template: New approved template with image header');

  // ─── Header with image ────────────────────────────────────────────────
  const header = {
    image: {
      file: data.imageUrl || 'https://www.gstatic.com/webp/gallery/1.png',
      name: 'Wedding Invitation',
    }
  };

  // ─── Button with dynamic URL (optional) ──────────────────────────────
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
  return sendWhatsAppTemplate({
    to: phone,
    template: 'swahili_invitation', // ✅ Your new approved template name
    personalisation: [
      {
        "var1": data.guestName,      // Habari {var1}
        "var2": data.hostFamily,     // Familia ya {var2}
        "var3": data.person1,        // sherehe ya {var3}
        "var4": data.person2,        // na {var4}
        "var5": data.date,           // tarehe {var5}
        "var6": data.venue,          // {var6}
        "var7": data.time,           // saa {var7}
        "var8": data.cardNumber,     // {var8}
        "var9": data.cardType,       // {var9}
      }
    ],
    header,   // ✅ Image header included
    button,   // Optional button
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