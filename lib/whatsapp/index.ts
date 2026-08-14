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
  button?: { url: string };
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

  console.log('[WhatsApp] Sending template:', template);
  console.log('[WhatsApp] Account:', NEXTSMS_ACCOUNT);
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

    if (!response.ok) {
      const errorMsg = data.message || data.error || `HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    const messageId = data.data?.messageId || data.messageId || data.id;

    return { success: true, messageId, data };
  } catch (error: any) {
    console.error('[WhatsApp] Error sending template:', error);
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
  // ✅ Header with image (required by your template)
  const header = {
    image: {
      file: data.imageUrl || 'https://www.gstatic.com/webp/gallery/1.png',
      name: 'Wedding Invitation',
    }
  };

  // ✅ If your template's button uses a variable (e.g., {{1}}), 
  // include the URL in personalisation and REMOVE the button object
  // If your template has a static button, keep the button object

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
        "10": data.inviteLink || 'https://littlewed.co.tz/invite/default', // ✅ URL as personalisation
      }
    ],
    header,
    // ❌ REMOVED: button object - URL is now in personalisation
    // button: { url: data.inviteLink || 'https://littlewed.co.tz/invite/default' },
  });
}

// ─── Alternative: If your template has NO button ──────────────────────────
export async function sendSimpleWeddingInvitation(
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
  }
): Promise<SendWhatsAppResult> {
  const header = data.imageUrl ? {
    image: {
      file: data.imageUrl,
      name: 'Wedding Invitation',
    }
  } : undefined;

  return sendWhatsAppTemplate({
    to: phone,
    template: 'LittleWed_Simple', // Use a template without button
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
  });
}