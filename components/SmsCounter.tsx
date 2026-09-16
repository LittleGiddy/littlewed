'use client';

import { smsUnits, SMS_MAX_CHARS_PER_PART } from '@/lib/sms/units';

// Live "N characters · M SMS" readout for any SMS composer. Feed it the fully
// resolved message (variables already filled with sample/typical values) so the
// count matches what NextSMS will actually bill.
//
// Pass `maxParts` (e.g. MAX_SMS_PARTS_PER_GUEST for a non-bypassed tenant, or
// null for bypassed/free accounts) to flag when the message would be rejected.
export default function SmsCounter({
  text,
  className = '',
  maxParts = null,
}: {
  text: string;
  className?: string;
  maxParts?: number | null;
}) {
  const { chars, parts } = smsUnits(text);
  const over = maxParts != null && parts > maxParts;
  return (
    <span
      className={`${className} ${over ? 'text-amber-600 font-semibold' : ''}`}
      title={`NextSMS counts ${SMS_MAX_CHARS_PER_PART} characters per SMS${
        maxParts != null ? ` - max ${maxParts} SMS per guest on your plan` : ''
      }`}
    >
      {chars.toLocaleString()} characters · {parts > 0 ? `${parts} SMS` : '0 SMS'}
      {over ? ` (max ${maxParts} on your plan)` : ''}
    </span>
  );
}