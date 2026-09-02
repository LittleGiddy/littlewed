// ─── Guest type constants & helpers (shared by client & server) ──────────

export const GUEST_TYPES = ['SINGLE', 'DOUBLE', 'FAMILIA', 'WAKWE'] as const;
export type GuestTypeValue = (typeof GUEST_TYPES)[number];

export interface GuestTypeInfo {
  type: GuestTypeValue;
  count: number | null;
}

// Parses a raw guestType value (e.g. "WAKWE 30", "familia", "SINGLE") into
// the canonical type plus an optional group count. The count is only used for
// FAMILIA/WAKWE (e.g. "WAKWE 30" → { type: 'WAKWE', count: 30 }).
export function parseGuestType(raw?: string | null): GuestTypeInfo {
  if (!raw) return { type: 'SINGLE', count: null };
  const trimmed = raw.trim().toUpperCase();
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