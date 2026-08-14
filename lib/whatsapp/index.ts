// lib/whatsapp/index.ts

const NEXTSMS_TOKEN = process.env.NEXTSMS_TOKEN!;
const NEXTSMS_ACCOUNT = process.env.NEXTSMS_ACCOUNT! || 'TANZANIATIP';
const NEXTSMS_API_URL = 'https://messaging-service.co.tz/api/whatsapp/v2/text/single';

// ─── Types ──────────────────────────────────────────────────────────────
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

// ─── Functions ──────────────────────────────────────────────────────────

/**
 * Send a WhatsApp template message via NexSMS
 */
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

  console.log('[WhatsApp] Sending to:', NEXTSMS_API_URL);
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

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('[WhatsApp] Non-JSON response:', {
        status: response.status,
        body: text.slice(0, 500),
      });
      throw new Error(`Server returned non-JSON (${response.status}).`);
    }

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

/**
 * Send a wedding invitation template
 */
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
  const personalisation = [
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
  ];

  const header = data.imageUrl ? {
    image: {
      file: data.imageUrl,
      name: 'Wedding Invitation',
    }
  } : undefined;

  const button = data.inviteLink ? {
    url: data.inviteLink,
  } : undefined;

  return sendWhatsAppTemplate({
    to: phone,
    template: 'event_invitation',
    personalisation,
    header,
    button,
  });
}

/**
 * Send a generic reminder template
 */
export async function sendReminder(
  phone: string,
  data: {
    name: string;
    eventName: string;
    date: string;
    venue: string;
    time: string;
  }
): Promise<SendWhatsAppResult> {
  const personalisation = [
    {
      "1": data.name,
      "2": data.eventName,
      "3": data.date,
      "4": data.venue,
      "5": data.time,
    }
  ];

  return sendWhatsAppTemplate({
    to: phone,
    template: 'event_reminder',
    personalisation,
  });
}

/**
 * Check if a phone number has WhatsApp
 */
export async function checkWhatsAppNumber(phone: string): Promise<{ hasWhatsApp: boolean; error?: string }> {
  // Since NexSMS doesn't have a direct check endpoint,
  // we assume WhatsApp is available and let the send API handle errors
  return { hasWhatsApp: true };
}