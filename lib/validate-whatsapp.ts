import twilio from 'twilio';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

export async function isWhatsAppNumber(phoneNumber: string): Promise<boolean> {
  try {
    const formatted = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    const lookup = await client.lookups.v2.phoneNumbers(formatted).fetch({
      fields: 'whatsapp',
    });
    // Use type assertion to bypass TypeScript's incomplete definitions
    const whatsappStatus = (lookup as any).whatsapp?.status;
    return whatsappStatus === 'active';
  } catch (error) {
    console.error(`WhatsApp lookup failed for ${phoneNumber}:`, error);
    return false; // fallback to SMS
  }
}