// lib/sms/units.ts

// NextSMS (messaging-service.co.tz) bills per SMS part: a single message holds
// up to this many characters before the provider splits it into a new part.
export const SMS_MAX_CHARS_PER_PART = 153;

// Hard cap for standard (non-bypassed) tenants: how many SMS parts each guest
// may be sent per send. Bypassed tenants skip this limit entirely.
export const MAX_SMS_PARTS_PER_GUEST = 1;

// Consistent, user-facing message used when a standard tenant exceeds the cap.
export function smsPartsError(parts: number): string {
  return `Your message uses ${parts} SMS parts. Your plan allows ${MAX_SMS_PARTS_PER_GUEST} SMS per guest (${SMS_MAX_CHARS_PER_PART} characters each) - please shorten your message.`;
}

// Characters the provider actually charges for (LF counted as one char).
function smsLength(message: string): number {
  return (message || '').replace(/\r\n/g, '\n').length;
}

// Number of SMS parts NextSMS will charge for a resolved message body.
// Returns 0 for an empty message (so the UI can show "0 SMS").
export function smsPartCount(message: string): number {
  const chars = smsLength(message);
  if (chars <= 0) return 0;
  return Math.max(1, Math.ceil(chars / SMS_MAX_CHARS_PER_PART));
}

export function smsUnits(message: string): { chars: number; parts: number } {
  const chars = smsLength(message);
  return { chars, parts: smsPartCount(message) };
}