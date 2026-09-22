import { prisma } from '@/lib/prisma';

/**
 * Helpers for enforcing the super admin "credits disabled" kill-switch.
 * A tenant with creditsEnabled === false effectively has 0 credits and is
 * blocked from credit-funded actions, regardless of Bypass Payment.
 */

export interface CreditsCheckTenant {
  credits: number | null;
  creditsEnabled?: boolean | null;
  bypassPayment?: boolean | null;
}

export function isCreditsDisabled(t?: CreditsCheckTenant | null): boolean {
  return t?.creditsEnabled === false;
}

export function effectiveCredits(t?: CreditsCheckTenant | null): number {
  return isCreditsDisabled(t) ? 0 : (t?.credits ?? 0);
}

export const CREDITS_DISABLED_MESSAGE =
  "Your account's credits have been disabled by the admin. Please contact support to re-enable them.";

/**
 * Cost (in credits) of resending an already-delivered invitation. Bypassed
 * tenants resend for free; standard tenants pay this amount per guest to
 * re-send one invitation over a channel they already used.
 */
export const RESEND_COST_PER_INVITATION = 1;

export interface ResendCreditCheck {
  allowed: boolean;
  creditsDisabled: boolean;
  creditsAvailable: number;
  creditsNeeded: number;
  /** Cost charged per individual resend. Exposed so the client can show it. */
  costPerResend: number;
  error?: string;
}

/**
 * Checks a tenant has enough credits to perform `count` resends and, when
 * they do, immediately deducts the credits and records the usage. Bypassed
 * tenants never reach this helper (their resends are free/unrestricted).
 */
export async function checkAndChargeResendCredits(
  tenantId: string,
  eventId: string,
  channel: 'whatsapp' | 'sms',
  count: number
): Promise<ResendCreditCheck> {
  const base: ResendCreditCheck = {
    allowed: false,
    creditsDisabled: false,
    creditsAvailable: 0,
    creditsNeeded: RESEND_COST_PER_INVITATION * count,
    costPerResend: RESEND_COST_PER_INVITATION,
  };
  if (!count || count <= 0) return { ...base, allowed: true };

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { credits: true, creditsEnabled: true },
  });

  const creditsDisabled = tenant?.creditsEnabled === false;
  const available = isCreditsDisabled(tenant) ? 0 : (tenant?.credits ?? 0);
  const needed = base.creditsNeeded;

  if (available < needed) {
    return {
      ...base,
      creditsDisabled,
      creditsAvailable: available,
      creditsNeeded: needed,
      error: creditsDisabled
        ? CREDITS_DISABLED_MESSAGE
        : `Insufficient credits. Resending ${count} invitation${count === 1 ? '' : 's'} needs ${needed} credit${needed === 1 ? '' : 's'}, but you have ${available}. Request more credits from the admin.`,
    };
  }

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { credits: { decrement: needed } },
  });

  await prisma.usageRecord.createMany({
    data: Array.from({ length: count }, () => ({
      tenantId,
      eventId,
      channel: `${channel}_resend`,
      cost: RESEND_COST_PER_INVITATION,
    })),
  });

  return {
    ...base,
    allowed: true,
    creditsDisabled,
    creditsAvailable: available - needed,
  };
}

/**
 * Refund credits for deleted guests that were never sent an invitation
 * (invitationSentAt == null). Credits are only refunded when the tenant is
 * not in bypass-payment mode (credits were never deducted there), and each
 * refunded guest is recorded as a negative usage entry so the ledger stays
 * consistent.
 *
 * Returns the number of credits actually refunded.
 */
export async function refundCreditsForUnsentDeleted(
  tenantId: string,
  eventId: string | null,
  count: number
): Promise<number> {
  if (!count || count <= 0) return 0;

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { bypassPayment: true },
  });

  // In bypass mode credits were never deducted, so there is nothing to refund.
  if (!tenant || tenant.bypassPayment) return 0;

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { credits: { increment: count } },
  });

  await prisma.usageRecord.createMany({
    data: Array.from({ length: count }, () => ({
      tenantId,
      eventId,
      channel: 'guest_refund',
      cost: -1,
    })),
  });

  return count;
}
