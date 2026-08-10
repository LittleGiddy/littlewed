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

/**
 * Checks if a phone number has an active WhatsApp account using Meta's Contacts API.
 * @param phoneNumber - The phone number in international format (including '+').
 * @returns An object indicating if the contact has WhatsApp and their wa_id.
 */
export async function isWhatsAppNumber(phoneNumber: string): Promise<MetaContactCheckResult> {
  try {
    // Clean the number: remove '+' and any spaces
    const cleanNumber = phoneNumber.replace(/^\+/, '').replace(/\s/g, '');

    // 1. Call the contacts endpoint
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
      throw new Error(errorMessage);
    }

    const data = await response.json();

    // 2. Parse the response
    const contact = data.contacts?.[0];
    if (!contact) {
      return {
        hasWhatsApp: false,
        error: 'No contact information returned',
      };
    }

    // A valid contact will have a wa_id and a status of 'valid'.
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

/**
 * Bulk check multiple phone numbers
 */
export async function checkWhatsAppNumbers(phones: string[]): Promise<MetaContactCheckResult[]> {
  const results: MetaContactCheckResult[] = [];
  for (const phone of phones) {
    const result = await isWhatsAppNumber(phone);
    results.push(result);
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return results;
}