import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function isWhatsAppNumber(phoneNumber: string): Promise<boolean> {
  try {
    const lookup = await client.lookups.v2.phoneNumbers(phoneNumber).fetch({
      fields: 'whatsapp',
    });
    return lookup.whatsapp?.status === 'active';
  } catch (error) {
    console.error(`WhatsApp lookup failed for ${phoneNumber}:`, error);
    return false;
  }
}