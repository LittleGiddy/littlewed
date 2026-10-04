// lib/phone.ts

export interface NormalizedPhone {
  normalized: string;      // +255XXXXXXXXX (with +)
  isValid: boolean;
  original: string;
}

/**
 * Normalize a Tanzanian phone number:
 * - Must start with '+'
 * - Remove spaces, dashes, parentheses, dots
 * - Must start with '255' after removing '+'
 * - Must be 12-13 digits after '+'
 */
export function normalizePhone(phone: string): NormalizedPhone {
  // Remove spaces, dashes, parentheses, dots
  let cleaned = phone.replace(/[\s\-()\.]/g, '');
  
  // Must start with '+'
  if (!cleaned.startsWith('+')) {
    return { normalized: '', isValid: false, original: phone };
  }
  
  // Remove '+' and validate digits
  const digits = cleaned.substring(1);
  if (!/^\d+$/.test(digits)) {
    return { normalized: '', isValid: false, original: phone };
  }
  
  // Must start with '255'
  if (!digits.startsWith('255')) {
    return { normalized: '', isValid: false, original: phone };
  }
  
  // Length should be 12 (255 + 9 digits) or 13 (255 + 10 digits)
  if (digits.length < 12 || digits.length > 13) {
    return { normalized: '', isValid: false, original: phone };
  }
  
  return { normalized: `+${digits}`, isValid: true, original: phone };
}

/**
 * Loose phone-number match for search boxes.
 *
 * Stored numbers are normalized to "+255XXXXXXXXX", but staff type local
 * forms such as "0712 345 678", "+255712345678" or just "712". A raw substring
 * comparison fails for all of those, so compare digits only and ignore the
 * local trunk "0" and the "255" country code.
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
 * Format phone number for display (e.g., +255 712 345 678)
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