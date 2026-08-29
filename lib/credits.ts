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
