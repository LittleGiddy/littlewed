import { prisma } from '@/lib/prisma';

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
