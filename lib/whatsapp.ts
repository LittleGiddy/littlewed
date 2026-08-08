// lib/whatsapp.ts

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const API_VERSION = 'v19.0';

interface SendMessageParams {
  to: string;                    // Phone number (e.g., 255712345678)
  type: 'text' | 'template';
  text?: string;
  templateName?: string;
  templateParams?: string[];
}

export async function sendWhatsAppMessage(params: SendMessageParams) {
  const { to, type, text, templateName, templateParams } = params;

  let body: any = {
    messaging_product: 'whatsapp',
    to: to.replace(/^\+/, ''),    // Remove leading '+'
  };

  if (type === 'text' && text) {
    body.type = 'text';
    body.text = { body: text };
  } else if (type === 'template' && templateName) {
    body.type = 'template';
    body.template = {
      name: templateName,
      language: { code: 'en' },
      components: templateParams ? [
        {
          type: 'body',
          parameters: templateParams.map((param) => ({
            type: 'text',
            text: param,
          })),
        },
      ] : [],
    };
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
      throw new Error(data.error?.message || 'Failed to send WhatsApp message');
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('[WhatsApp] Send error:', error);
    return { success: false, error: error.message };
  }
}

// ─── Quick test function ─────────────────────────────────────────────────
export async function testWhatsAppConnection(to: string) {
  const result = await sendWhatsAppMessage({
    to,
    type: 'text',
    text: 'Hello from LittleWed! Your WhatsApp integration is working 🎉',
  });

  return result;
}