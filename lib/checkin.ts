// lib/checkin.ts
// Small, pure rules for the check-in station. Kept out of the UI component so
// the decisions that matter (when to offer "Mark as Double") can be read and
// tested on their own.

export interface DoubleCandidate {
  fullyCheckedIn: boolean;
  guestType: string | null;
  checkInCount: number;
  maxCheckIns: number;
  /** True when this guest is one row of a shared card (a cardGroupId group). */
  sharedGroup?: boolean;
  groupMembers?: { id: string; checkedIn: boolean }[];
}

/**
 * Whether to offer "Mark as Double" after a scan.
 *
 * A DOUBLE couple often walks in together and hands over one card. Without this
 * the operator has to scan the same card a second time, which is why "Double"
 * cards felt slower than "Single" ones at the door.
 *
 * Two card shapes have to be handled:
 *
 * 1. Shared card - each person is their own guest row under one cardGroupId,
 *    and the scan path allows 1 scan per row. The first scan checks in the
 *    first person; the card is still incomplete, so offer the shortcut.
 *
 * 2. Legacy single-row DOUBLE - no cardGroupId, one row that counts to 2.
 *    After the first scan it reads 1/2, so the card is incomplete.
 *
 * Returns false once the card is already fully checked in, so the button can
 * never appear on a completed card.
 */
export function canMarkAsDouble(guest: DoubleCandidate): boolean {
  if (guest.fullyCheckedIn) return false;

  if (guest.sharedGroup) {
    const members = guest.groupMembers ?? [];
    if (members.length <= 1) return false;
    return members.some((m) => !m.checkedIn);
  }

  return (
    guest.guestType?.toUpperCase() === 'DOUBLE' &&
    guest.maxCheckIns === 2 &&
    guest.checkInCount < 2
  );
}
