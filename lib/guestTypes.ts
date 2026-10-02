// ─── Guest type constants & helpers (shared by client & server) ──────────

export const GUEST_TYPES = ['SINGLE', 'DOUBLE', 'FAMILIA', 'WAKWE'] as const;
export type GuestTypeValue = (typeof GUEST_TYPES)[number];

export interface GuestTypeInfo {
  type: GuestTypeValue;
  count: number | null;
}

// ─── Empty guest type tokens ───────────────────────────────────────────
// Spreadsheet/CSV exports represent "no guest type given" in many ways. All of
// these mean "not provided" and fall back to SINGLE; they are never an error,
// so a document with a null/blank guestType imports cleanly.
const EMPTY_GUEST_TYPE_TOKENS = new Set([
  '',
  '-',
  '--',
  '?',
  'n/a',
  'na',
  'nil',
  'none',
  'null',
  'undefined',
  'unknown',
  'not set',
  'empty',
  'blank',
  '0',
]);

// True when the raw value carries no guest type at all (null, undefined, blank
// or a placeholder token such as "N/A").
export function isEmptyGuestType(raw?: string | null): boolean {
  if (raw === null || raw === undefined) return true;
  return EMPTY_GUEST_TYPE_TOKENS.has(raw.trim().toLowerCase());
}

// Parses a raw guestType value (e.g. "WAKWE 30", "familia", "SINGLE") into
// the canonical type plus an optional group count. The count is only used for
// FAMILIA/WAKWE (e.g. "WAKWE 30" → { type: 'WAKWE', count: 30 }).
// A missing, blank or unrecognised value is never an error - it resolves to
// SINGLE so the guest still imports.
export function parseGuestType(raw?: string | null): GuestTypeInfo {
  if (isEmptyGuestType(raw)) return { type: 'SINGLE', count: null };
  const trimmed = (raw as string).trim().toUpperCase();
  const match = trimmed.match(/^([A-Z]+)\s*(\d+)?$/);
  if (!match) return { type: 'SINGLE', count: null };

  const base = match[1];
  if (!(GUEST_TYPES as readonly string[]).includes(base)) {
    return { type: 'SINGLE', count: null };
  }

  const count = match[2] ? parseInt(match[2], 10) : null;
  const isGroupType = base === 'FAMILIA' || base === 'WAKWE';
  return {
    type: base as GuestTypeValue,
    count: isGroupType && Number.isFinite(count) && (count as number) > 0 ? count : null,
  };
}

// Title-case display label used on cards and in message variables:
// Single | Double | Familia 30 | Wakwe 30
export function guestTypeLabel(type?: string | null, count?: number | null): string {
  const t = type?.toUpperCase();
  if (t === 'FAMILIA') return count ? `Familia ${count}` : 'Familia';
  if (t === 'WAKWE') return count ? `Wakwe ${count}` : 'Wakwe';
  return t === 'DOUBLE' ? 'Double' : 'Single';
}

// Uppercase badge label used in check-in/guest tables.
export function guestTypeBadge(type?: string | null, count?: number | null): string {
  const parsed = parseGuestType(type);
  if (parsed.type === 'FAMILIA' || parsed.type === 'WAKWE') {
    const c = count ?? parsed.count;
    return c ? `${parsed.type} ${c}` : parsed.type;
  }
  return parsed.type;
}

// Max allowed scans per guest record.
// SINGLE = 1, DOUBLE = 2, FAMILIA/WAKWE = guestCount (fallback 1).
export function guestTypeMaxScans(type?: string | null, count?: number | null): number {
  const parsed = parseGuestType(type);
  if (parsed.type === 'DOUBLE') return 2;
  if (parsed.type === 'FAMILIA' || parsed.type === 'WAKWE') {
    const c = count ?? parsed.count;
    return Number.isFinite(c) && (c as number) > 0 ? (c as number) : 1;
  }
  return 1;
}

// ─── Card-group helpers ────────────────────────────────────────────────
// A cardGroupId may carry a trailing number that defines how many times the
// card may be scanned: "Watu 20", "Familia 20", "Wakwe 20" → 20. When the
// label has no number the card simply holds one scan per guest row that
// shares it (the original shared-DOUBLE behaviour).
export function cardGroupIdCount(cardGroupId?: string | null): number | null {
  if (!cardGroupId) return null;
  const match = cardGroupId.trim().match(/(\d+)\s*$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// Total scans a card allows. A numeric cardGroupId label wins; otherwise the
// card holds one scan per guest row sharing the id.
export function cardTotalScans(
  cardGroupId: string | null | undefined,
  groupSize: number
): number {
  const label = cardGroupIdCount(cardGroupId);
  if (label !== null) return label;
  return Math.max(1, groupSize);
}

/**
 * Per-row scan ceiling used by the door and the guest tables.
 * - Numeric cardGroupId ("Watu 20"): the number is the card total and all scans
 *   accumulate on the group's oldest row, so that row's ceiling is the number.
 * - Shared card (cardGroupId, no number): each row is one person → 1.
 * - No group: the guestType rules (SINGLE 1, DOUBLE 2, FAMILIA/WAKWE count).
 */
export function guestRecordMaxScans(
  guest: {
    guestType?: string | null;
    guestCount?: number | null;
    cardGroupId?: string | null;
  },
  groupSize = 1
): number {
  if (guest.cardGroupId) {
    const label = cardGroupIdCount(guest.cardGroupId);
    if (label !== null) return label;
    if (groupSize > 1) return 1;
  }
  return guestTypeMaxScans(guest.guestType, guest.guestCount);
}