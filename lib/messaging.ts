// lib/messaging.ts

// ─── Import from the actual source files ──────────────────────────────
import { sendSMS } from './sms/index';
import type { SendSMSOptions } from './sms/index';
import { 
  sendWhatsAppTemplate,
  sendWeddingInvitation,
  sendReminder,
} from './whatsapp/index';
import type { SendWhatsAppTemplateOptions, SendWhatsAppResult } from './whatsapp/index';

// ─── Re-export everything ──────────────────────────────────────────────
export { 
  sendSMS, 
  sendWhatsAppTemplate,
  sendWeddingInvitation,
  sendReminder,
};
export type { SendSMSOptions, SendWhatsAppTemplateOptions, SendWhatsAppResult };

// ─── Combined function ──────────────────────────────────────────────────
export interface SendMessageOptions {
  to: string;
  channel: 'sms' | 'whatsapp';
  message?: string; // For SMS
  template?: string; // For WhatsApp
  personalisation?: Record<string, string>[];
  header?: { image?: { file: string; name?: string } };
  button?: { url: string };
}

export async function sendMessage({ 
  to, 
  channel, 
  message, 
  template, 
  personalisation,
  header,
  button,
}: SendMessageOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (channel === 'sms') {
    if (!message) {
      return { success: false, error: 'Message is required for SMS' };
    }
    return await sendSMS({ to, message });
  } else if (channel === 'whatsapp') {
    if (!template) {
      return { success: false, error: 'Template is required for WhatsApp' };
    }
    return await sendWhatsAppTemplate({
      to,
      template,
      personalisation,
      header,
      button,
    });
  }
  return { success: false, error: 'Invalid channel' };
}

// ─── Auto-detect channel ────────────────────────────────────────────────
export async function sendInvitation(
  guest: { phone: string; name: string; routingChannel: string },
  event: { name: string; date: string; venue: string }
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  if (guest.routingChannel === 'whatsapp') {
    return await sendWeddingInvitation(guest.phone, {
      name: guest.name,
      hostFamily: 'Mr & Mrs',
      person1: 'Agape',
      person2: 'Gladness',
      date: event.date,
      venue: event.venue,
      time: '5:00 PM',
      cardNumber: '001',
      cardType: 'SINGLE',
    });
  } else {
    return await sendSMS({
      to: guest.phone,
      message: `Hello ${guest.name}, you're invited to ${event.name}!`,
    });
  }
}