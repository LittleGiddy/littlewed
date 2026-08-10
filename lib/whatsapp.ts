// lib/whatsapp.ts

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const API_VERSION = 'v19.0';

export interface SendMessageParams {
  to: string;
  type: 'text' | 'template';
  text?: string;
  templateName?: string;
  templateParams?: string[];
}

export async function sendWhatsAppMessage(params: SendMessageParams) {
  const { to, type, text, templateName, templateParams } = params;

  if (!to) {
    return { success: false, error: 'Phone number is required' };
  }

  const cleanTo = to.replace(/^\+/, '');

  if (!/^[0-9]{10,15}$/.test(cleanTo)) {
    return { success: false, error: 'Invalid phone number format' };
  }

  let body: any = {
    messaging_product: 'whatsapp',
    to: cleanTo,
  };

  if (type === 'text' && text) {
    body.type = 'text';
    body.text = { body: text };
  } else if (type === 'template' && templateName) {
    body.type = 'template';
    body.template = {
      name: templateName,
      language: { code: 'en' },
    };

    if (templateParams && templateParams.length > 0) {
      body.template.components = [
        {
          type: 'body',
          parameters: templateParams.map((param) => ({
            type: 'text',
            text: param,
          })),
        },
      ];
    }
  } else {
    return { success: false, error: 'Invalid message type or missing parameters' };
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API error:', data);
      return { success: false, error: data.error?.message || 'Failed to send WhatsApp message' };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('[WhatsApp] Send error:', error);
    return { success: false, error: error.message };
  }
}

export async function sendInvitationTemplate(
  guest: {
    phone: string | null;
    name: string;
    cardNumber: string | null;
    title?: string | null;
  },
  event: {
    name: string;
    date: Date | string;
    venue: string;
    time?: string;
  }
) {
  if (!guest.phone) {
    return { success: false, error: 'Guest has no phone number' };
  }

  const fullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
  const cardNumber = guest.cardNumber || 'N/A';
  
  const eventDate = typeof event.date === 'string' ? new Date(event.date) : event.date;
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const formattedTime = event.time || eventDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const params = [
    fullName,
    event.name,
    formattedDate,
    event.venue,
    formattedTime,
    cardNumber,
  ];

  return await sendWhatsAppMessage({
    to: guest.phone,
    type: 'template',
    templateName: 'invitation_reminder',
    templateParams: params,
  });
}

// ─── Test function ────────────────────────────────────────────────────────
export async function testWhatsAppConnection(to: string) {
  const result = await sendWhatsAppMessage({
    to,
    type: 'text',
    text: 'Hello from LittleWed! Your WhatsApp integration is working 🎉',
  });

  return result;
}