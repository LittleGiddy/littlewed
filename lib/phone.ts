// lib/phone.ts

export interface NormalizedPhone {
  normalized: string;      // +<country code><national number> (with +)
  isValid: boolean;
  original: string;
}

/**
 * Minimum/maximum digits after '+' (E.164 allows up to 15).
 * The minimum keeps out obviously bogus input while still covering
 * every country's numbering plan.
 */
const MIN_PHONE_DIGITS = 8;
const MAX_PHONE_DIGITS = 15;

/**
 * Normalize an international phone number:
 * - Must start with '+'
 * - Remove spaces, dashes, parentheses, dots
 * - Digits only after '+', any country code accepted
 * - 8-15 digits after '+' (E.164)
 */
export function normalizePhone(phone: string): NormalizedPhone {
  // Remove spaces, dashes, parentheses, dots
  const cleaned = phone.replace(/[\s\-()\.]/g, '');

  // Must start with '+'
  if (!cleaned.startsWith('+')) {
    return { normalized: '', isValid: false, original: phone };
  }

  // Remove '+' and validate digits
  const digits = cleaned.substring(1);
  if (!/^\d+$/.test(digits)) {
    return { normalized: '', isValid: false, original: phone };
  }

  if (digits.length < MIN_PHONE_DIGITS || digits.length > MAX_PHONE_DIGITS) {
    return { normalized: '', isValid: false, original: phone };
  }

  return { normalized: `+${digits}`, isValid: true, original: phone };
}

/**
 * Loose phone-number match for search boxes.
 *
 * Stored numbers are normalized to "+<country code><number>", but staff type
 * local forms such as "0712 345 678", "+255712345678" or just "712". A raw
 * substring comparison fails for all of those, so compare digits only and
 * ignore the local trunk "0" and the "255" country code when present.
 */
export function phoneMatches(phone: string | null | undefined, query: string): boolean {
  const digits = (phone || '').replace(/\D/g, '');
  let q = (query || '').replace(/\D/g, '');
  if (!q) return false;
  if (digits.includes(q)) return true;
  if (q.startsWith('0')) q = q.slice(1);
  const national = digits.startsWith('255') ? digits.slice(3) : digits;
  return national.startsWith(q) || national.includes(q);
}

/**
 * Format phone number for display (e.g., +255 712 345 678).
 * Tanzanian numbers get grouped; any other country code is returned as typed.
 */
export function formatPhone(phone: string): string {
  if (!phone.startsWith('+')) return phone;
  const digits = phone.substring(1);
  if (digits.startsWith('255') && digits.length >= 12) {
    const rest = digits.substring(3);
    if (rest.length === 9) {
      return `+255 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
    }
    if (rest.length === 10) {
      return `+255 ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6, 8)} ${rest.slice(8)}`;
    }
  }
  return phone;
}