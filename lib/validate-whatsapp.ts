// lib/validate-whatsapp.ts

const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const API_VERSION = 'v19.0';

export interface MetaContactCheckResult {
  hasWhatsApp: boolean;
  waId?: string;
  error?: string;
  status?: string;
}

export async function isWhatsAppNumber(phoneNumber: string): Promise<MetaContactCheckResult> {
  try {
    const cleanNumber = phoneNumber.replace(/^\+/, '').replace(/\s/g, '');

    // Validate that PHONE_NUMBER_ID is set
    if (!PHONE_NUMBER_ID || PHONE_NUMBER_ID === 'your_phone_number_id') {
      console.warn('⚠️ WHATSAPP_PHONE_NUMBER_ID is not configured correctly');
      return { hasWhatsApp: false, error: 'WhatsApp not configured' };
    }

    const response = await fetch(
      `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/contacts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          blocking: 'wait',
          contacts: [cleanNumber],
          force_check: 'true',
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData?.error?.message || `API call failed (HTTP ${response.status})`;
      
      // Don't throw for 403/401 – just return false with error
      if (response.status === 401 || response.status === 403) {
        return {
          hasWhatsApp: false,
          error: 'WhatsApp API not configured. Please check your credentials.',
        };
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    const contact = data.contacts?.[0];
    
    if (!contact) {
      return {
        hasWhatsApp: false,
        error: 'No contact information returned',
      };
    }

    const hasWhatsApp = !!contact.wa_id && contact.status !== 'invalid' && contact.status !== 'failed';

    return {
      hasWhatsApp,
      waId: contact.wa_id,
      status: contact.status,
    };
  } catch (error: any) {
    console.error(`Meta Lookup failed for ${phoneNumber}:`, error);
    return {
      hasWhatsApp: false,
      error: error.message || 'Lookup failed',
    };
  }
}