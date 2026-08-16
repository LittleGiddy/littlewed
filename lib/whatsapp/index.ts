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
    throw new Error('NEXTSMS_TOKEN is not set');
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

    console.log('[WhatsApp] Response Status:', response.status);
    console.log('[WhatsApp] Response Data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      let errorMsg = data.message || data.error || `HTTP ${response.status}`;
      
      if (data.errors) {
        console.error('[WhatsApp] Error Details:', JSON.stringify(data.errors, null, 2));
      }

      throw new Error(errorMsg);
    }

    console.log('[WhatsApp] ✅ Message accepted by NexSMS');
    
    const messageId = data.messages?.[0]?.messageId || data.data?.messageId || data.messageId || data.id;

    return { success: true, messageId: String(messageId), data };
  } catch (error: any) {
    console.error('[WhatsApp] ❌ Error sending template:', error.message);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

// ─── Wedding Invitation (Full Template with Header & Button) ──────────

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

  const header = {
    image: {
      file: data.imageUrl || 'https://www.gstatic.com/webp/gallery/1.png',
      name: 'Wedding Invitation',
    }
  };

  const linkSuffix = data.inviteLink || 'default';

  return sendWhatsAppTemplate({
    to: phone,
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
}

// ─── Simple Template (No Header, No Button) ──────────────────────────

export async function sendSimpleTestMessage(
  phone: string,
  data: {
    name: string;
    cardNumber: string;
  }
): Promise<SendWhatsAppResult> {
  console.log('[WhatsApp] ====== SENDING SIMPLE TEST MESSAGE ======');

  return sendWhatsAppTemplate({
    to: phone,
    template: 'test_simple',
    personalisation: [
      {
        "1": data.name,
        "2": data.cardNumber,
      }
    ],
  });
}

// ─── Hello World Test ──────────────────────────────────────────────────

export async function sendHelloWorld(
  phone: string
): Promise<SendWhatsAppResult> {
  console.log('[WhatsApp] ====== SENDING HELLO WORLD ======');

  return sendWhatsAppTemplate({
    to: phone,
    template: 'hello_world',
  });
}

/**
 * Helper: Convert a full URL to just the suffix
 */
export function toLinkSuffix(value: string): string {
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || value;
  } catch {
    return value;
  }
}