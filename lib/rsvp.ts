import { createHmac, timingSafeEqual } from 'crypto';

export const RSVP_ACTIONS = {
  ATTENDING: 'ATTENDING',
  DECLINED: 'DECLINED',
} as const;

export type RsvpAction = (typeof RSVP_ACTIONS)[keyof typeof RSVP_ACTIONS];

export const RSVP_STATUS_BY_ACTION: Record<RsvpAction, 'yes' | 'no'> = {
  ATTENDING: 'yes',
  DECLINED: 'no',
};

const PAYLOAD_PREFIX = 'rsvp';

function getSecret(): string {
  const secret = process.env.RSVP_TOKEN_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('RSVP_TOKEN_SECRET or NEXTAUTH_SECRET is not configured');
  }
  return secret;
}

function sign(value: string): string {
  return createHmac('sha256', getSecret()).update(value).digest('base64url');
}

export function createRsvpPayload(guestId: string, action: RsvpAction): string {
  const value = `${PAYLOAD_PREFIX}.${guestId}.${action}`;
  return `${value}.${sign(value)}`;
}

export function verifyRsvpPayload(payload: string): { guestId: string; action: RsvpAction } | null {
  try {
    const parts = payload.split('.');
    if (parts.length !== 4 || parts[0] !== PAYLOAD_PREFIX) return null;

    const [, guestId, action, signature] = parts;
    if (!guestId || !signature) return null;
    if (action !== RSVP_ACTIONS.ATTENDING && action !== RSVP_ACTIONS.DECLINED) return null;

    const expected = sign(`${PAYLOAD_PREFIX}.${guestId}.${action}`);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);

    if (providedBuffer.length !== expectedBuffer.length) return null;
    if (!timingSafeEqual(providedBuffer, expectedBuffer)) return null;

    return { guestId, action };
  } catch {
    return null;
  }
}

export function actionFromButtonLabel(label: string): RsvpAction | null {
  const normalized = label.trim().toLowerCase();
  if (normalized === 'nitashiriki') return RSVP_ACTIONS.ATTENDING;
  if (normalized === 'sitashiriki') return RSVP_ACTIONS.DECLINED;
  return null;
}
