// Contribution ("Mchango") tracking helpers.
//
// One `Contribution` row per guest, created when the guest is first reminded.
// The important predicate here is `isContributionSettled`: it is what the
// reminder pipeline uses to decide who is still worth chasing, so guests who
// have finished paying stop getting reminders.

export const CONTRIBUTION_STATUSES = ['PENDING', 'PARTIAL', 'PAID'] as const;
export type ContributionStatus = (typeof CONTRIBUTION_STATUSES)[number];

export function parseContributionStatus(value: unknown): ContributionStatus {
  const v = String(value ?? '').trim().toUpperCase();
  return (CONTRIBUTION_STATUSES as readonly string[]).includes(v)
    ? (v as ContributionStatus)
    : 'PENDING';
}

export const CONTRIBUTION_STATUS_META: Record<
  ContributionStatus,
  { label: string; labelSw: string; description: string; tone: string }
> = {
  PENDING: {
    label: 'Not started',
    labelSw: 'Bado',
    description: 'No contribution recorded yet.',
    tone: 'pending',
  },
  PARTIAL: {
    label: 'Partial',
    labelSw: 'Sehemu',
    description: 'Some money received, still outstanding.',
    tone: 'partial',
  },
  PAID: {
    label: 'Completed',
    labelSw: 'Imekamilika',
    description: 'Contribution received in full.',
    tone: 'paid',
  },
};

/**
 * Has this guest finished contributing?
 *
 * True when the status is explicitly PAID, or when an expected amount is set
 * and the paid amount has reached it. Returning true for a PAID row is what
 * keeps the reminder pipeline from re-chasing someone who has paid, even if
 * nobody ever ticked the box.
 */
export function isContributionSettled(
  contribution:
    | { status?: string | null; amountPaid?: number | null; amountExpected?: number | null }
    | null
    | undefined
): boolean {
  if (!contribution) return false;
  if (parseContributionStatus(contribution.status) === 'PAID') return true;
  const expected = contribution.amountExpected;
  const paid = contribution.amountPaid ?? 0;
  if (typeof expected === 'number' && expected > 0 && paid >= expected) return true;
  return false;
}

/**
 * Normalise a status against the amounts so the two can never disagree.
 * Reaching the expected amount implies PAID, and a PAID row with a known
 * target is given the target as its paid amount.
 */
export function reconcileContribution(input: {
  status?: ContributionStatus | null;
  amountPaid?: number | null;
  amountExpected?: number | null;
}): { status: ContributionStatus; amountPaid: number; amountExpected: number | null } {
  const status = parseContributionStatus(input.status);
  const amountExpected =
    typeof input.amountExpected === 'number' && input.amountExpected >= 0
      ? Math.round(input.amountExpected)
      : null;
  const amountPaid =
    typeof input.amountPaid === 'number' && input.amountPaid > 0
      ? Math.round(input.amountPaid)
      : 0;

  if (amountExpected && amountExpected > 0 && amountPaid >= amountExpected) {
    return { status: 'PAID', amountPaid, amountExpected };
  }
  if (status === 'PAID') {
    // Keep the recorded figure exactly as it was entered. An earlier version
    // overwrote it with the expected amount on any PAID row, which was
    // defensible while "mark completed" was a separate, figure-less action but
    // not now that a guest types the amount and the status together: it let a
    // guest who entered 200,000 against a 500,000 target silently inflate the
    // collected total by 300,000. `isContributionSettled` still treats a PAID
    // row as settled, so the reminder pipeline is unaffected.
    return { status: 'PAID', amountPaid, amountExpected };
  }
  return {
    status: amountPaid > 0 ? 'PARTIAL' : 'PENDING',
    amountPaid,
    amountExpected,
  };
}

export interface ContributionSummary {
  total: number;
  pending: number;
  partial: number;
  paid: number;
  settled: number;
  outstanding: number;
  collected: number;
  target: number | null;
  currency: string;
}

/** Roll a list of contribution rows up into headline numbers for the UI. */
export function summariseContributions(
  rows: Array<{
    status?: string | null;
    amountPaid?: number | null;
    amountExpected?: number | null;
  }>,
  opts: { target?: number | null; currency?: string | null } = {}
): ContributionSummary {
  let pending = 0;
  let partial = 0;
  let paid = 0;
  let collected = 0;
  let outstanding = 0;

  for (const row of rows) {
    const status = parseContributionStatus(row.status);
    if (status === 'PAID') paid += 1;
    else if (status === 'PARTIAL') partial += 1;
    else pending += 1;

    collected += row.amountPaid ?? 0;
    const expected = row.amountExpected ?? null;
    if (expected && expected > 0) {
      outstanding += Math.max(0, expected - (row.amountPaid ?? 0));
    }
  }

  return {
    total: rows.length,
    pending,
    partial,
    paid,
    settled: paid,
    outstanding,
    collected,
    target: opts.target ?? null,
    currency: opts.currency || 'TZS',
  };
}

/** Group an amount into thousands, e.g. 1500000 -> "1,500,000". */
export function formatTZS(amount: number | null | undefined, currency = 'TZS'): string {
  const n = amount ?? 0;
  const grouped = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${grouped} ${currency}`;
}

/**
 * Mask a phone number for the public tracker: 0762208760 -> 0762 *** 760.
 * The public page must never publish a full contact list.
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '—';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return `${digits.slice(0, 2)} ****`;
  const head = digits.slice(0, 4);
  const tail = digits.slice(-3);
  return `${head} *** ${tail}`;
}
