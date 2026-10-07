// app/[id]/contributions/ContributionTracker.tsx
//
// The event owner's contribution ledger. This link belongs to the wedding
// owner, not to the guests: they open it to record what they have actually
// received from each guest and watch the totals move.
//
// That changes the voice of the whole screen. The earlier version was written
// for guests, so every control spoke to the visitor ("I have sent my
// contribution", "How much did you send?", "Asante, Neema!"). A guest is never
// the person filling this in, so that copy is gone and each action is named
// from the owner's side of the transaction: record, receive, received.
//
// Payment instructions were removed for the same reason — the owner already has
// those numbers in their Event Details and the ledger has no reason to restate
// them. Editing them belongs on the event, not here.
//
// The hero carries only what identifies the event: its name, its type, the
// date and the venue. The host family line went back to Event Details, where
// it belongs.
//
// Layout is phone-first. The status filter is a scrolling chip row rather than
// a segmented bar (four labelled segments plus counts overflowed a 360px
// screen), the per-row action is the row itself instead of a full-width
// button, and tapping a guest opens a sheet with their complete details —
// full, unmasked phone number, amounts, note and history — before the form.
//
// Visual language is shared with the tenant-side manager (widgets.tsx) so the
// two screens do not drift apart.
'use client';

import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpDown,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Copy,
  Hourglass,
  MapPin,
  PartyPopper,
  Phone,
  RefreshCw,
  Search,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AppAvatar,
  AppBottomSheet,
  AppButton,
  AppCard,
  AppCardTitle,
  AppChip,
  AppEmptyState,
  AppInput,
} from '@/components/ui';
import {
  CONTRIBUTION_STATUS_META,
  formatTZS,
  type ContributionStatus,
} from '@/lib/contributions';
import { motionEase, useReducedMotion, useTransition } from '@/lib/motion';
import { confirmToast } from '@/lib/confirmToast';
import { ProgressRing, StatTiles, buildTiles } from '@/app/client/events/[id]/contributions/widgets';

interface TrackerEvent {
  id: string;
  /** The event name as set in Event Details. */
  name: string;
  eventType: string | null;
  /** Already formatted as a Swahili date by the server. */
  date: string;
  /** From Event Details. Falls back to the address when no venue was set. */
  venue: string | null;
  address: string | null;
  currency: string;
  target: number | null;
}

interface TrackerRow {
  /** Empty for a guest who has no Contribution row yet. */
  id: string;
  guestId: string;
  guestName: string;
  /** The guest's own name without the title — what the edit form binds to. */
  name: string;
  /** Full number, in whatever format Event Details holds it. Null when unset. */
  phone: string | null;
  status: ContributionStatus;
  amountPaid: number;
  amountExpected: number | null;
  note: string | null;
  updatedAt: string | null;
  /**
   * A name/phone proposal filed from this tracker that the event planner has
   * not answered yet. Null for everyone else - the guest list itself never
   * changes from here, only through an accepted request.
   */
  pendingEdit: { name: string; phone: string | null } | null;
}

interface TrackerSummary {
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

interface TrackerPayload {
  event: TrackerEvent;
  summary: TrackerSummary;
  rows: TrackerRow[];
}

type Filter = 'ALL' | ContributionStatus;
type SortKey = 'NAME' | 'OUTSTANDING' | 'RECENT';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Not started' },
  { value: 'PARTIAL', label: 'Part paid' },
  { value: 'PAID', label: 'Completed' },
];

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'NAME', label: 'Name A–Z' },
  { value: 'OUTSTANDING', label: 'Most outstanding' },
  { value: 'RECENT', label: 'Recently updated' },
];

const QUICK_ADD = 50_000;

const STATUS_TONE: Record<ContributionStatus, 'success' | 'warn' | 'neutral'> = {
  PAID: 'success',
  PARTIAL: 'warn',
  PENDING: 'neutral',
};

const CHEVRON =
  "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280' stroke-width='2'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' d='m19.5 8.25-7.5 7.5-7.5-7.5'/%3e%3c/svg%3e\")";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function remainingOf(row: TrackerRow) {
  return row.amountExpected && row.amountExpected > row.amountPaid
    ? row.amountExpected - row.amountPaid
    : 0;
}

/** Digits only, so "0762 208 760", "+255 762 208 760" and "762208760" all match. */
function digitsOf(value: string | null | undefined) {
  return (value ?? '').replace(/\D/g, '');
}

function reducedInitial(transition: { duration: number }) {
  return transition.duration === 0 ? { opacity: 0 } : { opacity: 0, y: 10 };
}

export default function ContributionTracker({
  eventId,
  initialData,
}: {
  eventId: string;
  initialData: TrackerPayload;
}) {
  const [data, setData] = useState<TrackerPayload>(initialData);
  // Adopt fresh server data without an effect: the parent is a server
  // component, so a new payload means navigation to a different event.
  const [lastInitial, setLastInitial] = useState(initialData);
  if (initialData !== lastInitial) {
    setLastInitial(initialData);
    setData(initialData);
  }

  const [filter, setFilter] = useState<Filter>('ALL');
  const [sort, setSort] = useState<SortKey>('NAME');
  const [recordedOnly, setRecordedOnly] = useState(false);
  const [notedOnly, setNotedOnly] = useState(false);
  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TrackerRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const transition = useTransition();
  const reduced = useReducedMotion();

  const currency = data.event.currency || data.summary.currency || 'TZS';

  /**
   * One write path for the whole screen.
   *
   * The server echoes back a full payload, so a successful write replaces the
   * summary and rows wholesale rather than patching them locally. That is what
   * keeps a tap from leaving the headline totals stale.
   */
  const patch = useCallback(
    async (
      row: TrackerRow,
      body: Record<string, unknown>,
      successMessage: string
    ) => {
      setSavingId(row.guestId);
      const previous = data;
      // Optimistic: the totals should not sit still while a write is in flight.
      if ('status' in body) {
        setData((cur) => ({
          ...cur,
          rows: cur.rows.map((r) =>
            r.guestId === row.guestId ? { ...r, status: body.status as ContributionStatus } : r
          ),
        }));
      }
      try {
        const res = await fetch(`/api/public/events/${eventId}/contributions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId: row.guestId, ...body }),
        });
        const payload = await res.json().catch(() => null);
        if (!res.ok) throw new Error(payload?.error || 'Could not save');
        setData((cur) => ({ ...cur, summary: payload.summary, rows: payload.rows }));
        toast.success(successMessage);
        return true;
      } catch (error) {
        setData(previous);
        toast.error(error instanceof Error ? error.message : 'Could not save');
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [data, eventId]
  );

  /**
   * One action, not two.
   *
   * Previously the row had three status buttons *and* a separate amount editor,
   * so the two could disagree: marking someone completed recorded no figure and
   * the collected total never moved. The owner states how much has come in and
   * whether that settles the guest, in a single pass, and the server reconciles
   * the status from the two (see reconcileContribution).
   */
  const recordContribution = useCallback(
    async (row: TrackerRow, amountPaid: number, finished: boolean, note: string) => {
      return patch(
        row,
        { amountPaid, status: finished ? 'PAID' : 'PARTIAL', note: note.trim() || undefined },
        finished
          ? `${row.guestName} marked complete`
          : `Recorded ${formatTZS(amountPaid, currency)} from ${row.guestName}`
      );
    },
    [patch, currency]
  );

  /**
   * Propose a name/phone correction. The server files it as a
   * GuestEditRequest and tells the planner; nothing here touches the guest
   * list until they accept, so the optimistic step is only the pending chip.
   */
  const sendEditRequest = useCallback(
    async (row: TrackerRow, details: { name: string; phone: string }) => {
      try {
        const res = await fetch(`/api/public/events/${eventId}/edit-requests`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId: row.guestId, ...details }),
        });
        const payload = (await res.json().catch(() => null)) as
          | { error?: string; unchanged?: boolean; pendingEdit?: TrackerRow['pendingEdit'] }
          | null;
        if (!res.ok) throw new Error(payload?.error || 'Could not send the request');
        if (payload?.pendingEdit) {
          const pendingEdit = payload.pendingEdit;
          setData((cur) => ({
            ...cur,
            rows: cur.rows.map((r) => (r.guestId === row.guestId ? { ...r, pendingEdit } : r)),
          }));
        }
        if (!payload?.unchanged) toast.success('Sent to the event planner for approval');
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not send the request');
        return false;
      }
    },
    [eventId]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/public/events/${eventId}/contributions`);
      if (!res.ok) throw new Error('Could not refresh');
      setData(await res.json());
      toast.success('Updated');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not refresh');
    } finally {
      setRefreshing(false);
    }
  }, [eventId]);

  const counts = useMemo(
    () => ({
      ALL: data.rows.length,
      PENDING: data.summary.pending,
      PARTIAL: data.summary.partial,
      PAID: data.summary.paid,
    }),
    [data.rows.length, data.summary]
  );

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qDigits = digitsOf(q);

    const filtered = data.rows.filter((r) => {
      if (filter !== 'ALL' && r.status !== filter) return false;
      if (recordedOnly && !r.id) return false;
      if (notedOnly && !r.note) return false;
      if (!q) return true;
      const byName = r.guestName.toLowerCase().includes(q);
      // Phone search is digit-based, so punctuation and country codes in the
      // query never stop a match.
      const byPhone = qDigits.length > 0 && digitsOf(r.phone).includes(qDigits);
      return byName || byPhone;
    });

    return filtered.sort((a, b) => {
      if (sort === 'OUTSTANDING') {
        const diff = remainingOf(b) - remainingOf(a);
        if (diff !== 0) return diff;
      }
      if (sort === 'RECENT') {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
      }
      return a.guestName.localeCompare(b.guestName);
    });
  }, [data.rows, filter, query, recordedOnly, notedOnly, sort]);

  const filtersActive =
    filter !== 'ALL' || sort !== 'NAME' || recordedOnly || notedOnly || query.trim() !== '';

  const clearFilters = () => {
    setFilter('ALL');
    setSort('NAME');
    setRecordedOnly(false);
    setNotedOnly(false);
    setQuery('');
  };

  const progressPct =
    data.summary.target && data.summary.target > 0
      ? Math.min(100, Math.round((data.summary.collected / data.summary.target) * 100))
      : null;

  // Event Details is the single source of the event's name, so the heading is
  // that name verbatim. The occasion sits under it as context rather than
  // replacing it, which is what a ledger is titled with.
  const eventName = data.event.name || 'Contributions';
  const venue = data.event.venue || data.event.address;

  const details = [
    { icon: CalendarClock, label: 'Event date', value: data.event.date },
    { icon: MapPin, label: 'Venue', value: venue || 'Not set' },
  ];

  // The server echo replaces `rows`, so the open sheet reads the fresh copy
  // rather than the snapshot it was opened with.
  const editingLive = editing
    ? (data.rows.find((r) => r.guestId === editing.guestId) ?? editing)
    : null;

  return (
    <div className="min-h-dvh bg-canvas pb-16">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-brand text-white">
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.16]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.16 }}
          transition={{ duration: reduced ? 0 : 0.8 }}
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 12%, #ffffff 0, transparent 42%), radial-gradient(circle at 88% 82%, #7fb5b4 0, transparent 46%)',
          }}
        />
        <div className="relative mx-auto w-full max-w-3xl px-4 pb-14 pt-9 sm:px-6 sm:pb-16 sm:pt-14">
          <motion.div
            initial={reducedInitial(transition)}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
          >
            <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-200">
              <PartyPopper className="size-3.5 shrink-0" aria-hidden="true" />
              Contributions
            </p>
            {/* The event's own name from Event Details. */}
            <h1 className="mt-2.5 break-words font-display text-[27px] leading-[1.15] sm:text-4xl">
              {eventName}
            </h1>
            {data.event.eventType ? (
              <p className="mt-1.5 break-words text-sm text-brand-100">{data.event.eventType}</p>
            ) : null}
          </motion.div>

          <motion.dl
            className="mt-5 grid gap-2 sm:grid-cols-2"
            initial="hidden"
            animate="shown"
            variants={{
              hidden: {},
              shown: { transition: { staggerChildren: reduced ? 0 : 0.06 } },
            }}
          >
            {details.map((item) => (
              <motion.div
                key={item.label}
                variants={{
                  hidden: reduced ? { opacity: 0 } : { opacity: 0, y: 10 },
                  shown: { opacity: 1, y: 0 },
                }}
                transition={transition}
                className="rounded-card bg-white/10 px-3.5 py-3 ring-1 ring-inset ring-white/15"
              >
                <dt className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-wide text-brand-200">
                  <item.icon className="size-3.5 shrink-0" aria-hidden="true" />
                  {item.label}
                </dt>
                {/* Wraps rather than truncates: a long venue stays readable. */}
                <dd className="mt-1 break-words text-sm font-semibold leading-snug">{item.value}</dd>
              </motion.div>
            ))}
          </motion.dl>
        </div>
      </header>

      <main className="relative mx-auto -mt-8 w-full max-w-3xl space-y-4 px-4 sm:px-6">
        {/* ── Progress ────────────────────────────────────────────────────── */}
        <AppCard>
          <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
            <ProgressRing
              pct={progressPct ?? (data.summary.collected > 0 ? 100 : 0)}
              collected={data.summary.collected}
              target={data.summary.target}
              currency={currency}
            />
            <div className="w-full min-w-0 flex-1">
              <StatTiles
                tiles={buildTiles({
                  collected: data.summary.collected,
                  currency,
                  total: data.summary.total,
                  pending: data.summary.pending,
                  partial: data.summary.partial,
                  paid: data.summary.paid,
                  outstanding: data.summary.outstanding,
                })}
              />
              {progressPct !== null ? (
                <p className="mt-3 text-center text-[12px] leading-relaxed text-muted sm:text-left">
                  <span className="font-semibold text-ink">{progressPct}%</span> of the target
                  collected
                  {data.summary.outstanding > 0
                    ? ` · ${formatTZS(data.summary.outstanding, currency)} still outstanding`
                    : ' · nothing outstanding'}
                </p>
              ) : null}
            </div>
          </div>
        </AppCard>

        {/* ── Guest ledger ────────────────────────────────────────────────── */}
        <AppCard padded={false}>
          <div className="space-y-3 border-b border-line p-4">
            <div className="flex items-start justify-between gap-3">
              <AppCardTitle
                title="Guest contributions"
                subtitle="Tap a guest to see their full details and record what you received."
              />
              <button
                type="button"
                onClick={() => void refresh()}
                disabled={refreshing}
                aria-label="Refresh"
                className="grid size-9 shrink-0 place-items-center rounded-tap text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
              >
                <RefreshCw
                  className={refreshing ? 'animate-spin' : undefined}
                  size={16}
                  aria-hidden="true"
                />
              </button>
            </div>

            {/* Search: name or phone, punctuation-insensitive on the number. */}
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <AppInput
                type="search"
                inputMode="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or phone number"
                aria-label="Search guests by name or phone number"
                className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>

            {/* Status chips scroll sideways instead of squeezing four labelled
                segments into a phone-width bar. */}
            <div
              className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label="Filter contributions by status"
            >
              {FILTERS.map((option) => {
                const active = filter === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFilter(option.value)}
                    className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
                      active
                        ? 'border-brand bg-brand text-white shadow-brand-sm'
                        : 'border-line bg-surface text-muted hover:border-brand/40 hover:text-ink'
                    }`}
                  >
                    {option.label}
                    <span
                      className={`text-[11px] font-bold tabular-nums ${
                        active ? 'text-white/75' : 'text-gray-400'
                      }`}
                    >
                      {counts[option.value]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Secondary rules: sort order plus two record-based filters. */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <ArrowUpDown
                  size={13}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortKey)}
                  aria-label="Sort guests"
                  className="h-9 appearance-none rounded-full border border-line bg-surface py-0 pl-8 pr-8 text-[13px] font-semibold text-ink transition-colors hover:border-brand/40"
                  style={{ backgroundImage: CHEVRON, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.65rem center', backgroundSize: '14px' }}
                >
                  {SORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <ToggleChip
                label="With record"
                active={recordedOnly}
                onClick={() => setRecordedOnly((v) => !v)}
              />
              <ToggleChip
                label="With note"
                active={notedOnly}
                onClick={() => setNotedOnly((v) => !v)}
              />
            </div>

            <p className="text-[12px] text-muted" aria-live="polite">
              Showing <span className="font-semibold text-ink">{visibleRows.length}</span> of{' '}
              {data.summary.total} guest{data.summary.total === 1 ? '' : 's'}
              {filtersActive ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="ml-2 font-semibold text-brand underline underline-offset-2"
                >
                  Clear
                </button>
              ) : null}
            </p>
          </div>

          {visibleRows.length === 0 ? (
            <AppEmptyState
              icon={<Users size={20} />}
              size="sm"
              title={
                data.rows.length === 0 ? 'No guests on this event yet' : 'No guests match'
              }
              description={
                data.rows.length === 0
                  ? 'Once guests are added to the event they will appear here.'
                  : 'Try a different name, phone number, or filter.'
              }
              action={
                filtersActive && data.rows.length > 0 ? (
                  <AppButton size="sm" variant="secondary" onClick={clearFilters}>
                    Clear filters
                  </AppButton>
                ) : undefined
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              <AnimatePresence initial={false} mode="popLayout">
                {visibleRows.map((row) => (
                  <motion.li
                    key={row.guestId}
                    layout={!reduced}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.18, ease: motionEase }}
                  >
                    <GuestRow
                      row={row}
                      currency={currency}
                      busy={savingId === row.guestId}
                      onOpen={() => setEditing(row)}
                    />
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </AppCard>

        <AppCard tone="tinted">
          <div className="space-y-1.5 text-center">
            <p className="flex items-center justify-center gap-2 text-[13px] font-medium text-ink">
              <CheckCircle2 size={14} className="shrink-0 text-brand" aria-hidden="true" />
              Guests marked completed stop receiving reminders.
            </p>
            <p className="text-[11px] leading-relaxed text-muted">
              Contributions are saved to this event straight away. Name and number
              corrections go to the event planner to approve first.
            </p>
          </div>
        </AppCard>
      </main>

      <GuestSheet
        row={editingLive}
        currency={currency}
        saving={savingId === editingLive?.guestId}
        onClose={() => setEditing(null)}
        onSave={async ({ record, details }) => {
          if (!editingLive) return false;
          // Details first: if the planner-bound proposal fails to send, the
          // sheet stays open and the visitor never believes it went through.
          if (details && !(await sendEditRequest(editingLive, details))) return false;
          if (
            record &&
            !(await recordContribution(editingLive, record.amountPaid, record.finished, record.note))
          ) {
            return false;
          }
          setEditing(null);
          return true;
        }}
      />
    </div>
  );
}

/** Rounded filter toggle, same footprint as the status chips. */
function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors ${
        active
          ? 'border-brand bg-brand text-white shadow-brand-sm'
          : 'border-line bg-surface text-muted hover:border-brand/40 hover:text-ink'
      }`}
    >
      {active ? <Check size={13} aria-hidden="true" /> : null}
      {label}
    </button>
  );
}

function GuestRow({
  row,
  currency,
  busy,
  onOpen,
}: {
  row: TrackerRow;
  currency: string;
  busy: boolean;
  onOpen: () => void;
}) {
  const meta = CONTRIBUTION_STATUS_META[row.status];
  const remaining = remainingOf(row);

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={busy}
      aria-label={`Open ${row.guestName}'s contribution`}
      className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/70 active:bg-surface-2 disabled:opacity-60"
    >
      <AppAvatar name={row.guestName} size="md" className="mt-0.5" />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          <span className="min-w-0 break-words text-[14px] font-semibold leading-snug text-ink">
            {row.guestName}
          </span>
          <AppChip tone={STATUS_TONE[row.status]}>{meta.label}</AppChip>
          {row.pendingEdit ? (
            <AppChip tone="warn">Awaiting approval</AppChip>
          ) : null}
        </span>

        {/* Full number on its own line: never truncated, always readable. */}
        {row.phone ? (
          <span className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
            <Phone size={12} className="shrink-0" aria-hidden="true" />
            <span className="break-all tabular-nums">{row.phone}</span>
          </span>
        ) : (
          <span className="mt-1 block text-[13px] text-muted">No phone number</span>
        )}

        {row.amountPaid > 0 || row.amountExpected ? (
          <span className="mt-1 block text-[12px] tabular-nums text-ink">
            {formatTZS(row.amountPaid, currency)} received
            {row.amountExpected ? (
              <span className="text-muted"> of {formatTZS(row.amountExpected, currency)}</span>
            ) : null}
            {remaining > 0 ? <span className="text-warn"> · {formatTZS(remaining, currency)} left</span> : null}
          </span>
        ) : null}

        {row.note ? (
          <span className="mt-1 block break-words text-[12px] italic leading-snug text-muted">
            “{row.note}”
          </span>
        ) : null}

        {row.updatedAt ? (
          <span className="mt-1 block text-[11px] text-muted">Updated {formatDate(row.updatedAt)}</span>
        ) : null}
      </span>

      <ChevronRight size={16} className="mt-1.5 shrink-0 text-gray-300" aria-hidden="true" />
    </button>
  );
}

/**
 * Full guest details first, then the recording form.
 *
 * "How much has come in from them, and does that settle it?" is answered in
 * one sheet: the details block shows who this is (full phone number included,
 * with call and copy), what has arrived and what is left, and the form below
 * turns that into a record. Splitting the figure and the status across two
 * controls is what let a guest be ticked off without one, leaving the
 * collected total unchanged.
 *
 * The figure a guest is expected to pay is not editable here — that is the
 * target the owner set for the event, and a record of what arrived should not
 * be able to move it.
 */
function GuestSheet({
  row,
  currency,
  saving,
  onClose,
  onSave,
}: {
  row: TrackerRow | null;
  currency: string;
  saving: boolean;
  onClose: () => void;
  onSave: (input: {
    record: { amountPaid: number; finished: boolean; note: string } | null;
    details: { name: string; phone: string } | null;
  }) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  // null until the owner answers, so the sheet never presumes "settled" on
  // their behalf — that decision is the whole point of the question.
  const [finished, setFinished] = useState<boolean | null>(null);
  // The name/phone fields bind to whatever is already proposed when a request
  // is waiting, so a visitor resubmitting a typo sees what they sent last time
  // rather than the stale original.
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [detailSeed, setDetailSeed] = useState({ name: '', phone: '' });

  // Re-seed during render rather than in an effect so opening a guest never
  // shows the previous guest's figures for a frame. Keyed by guestId so the
  // server echo arriving mid-edit does not wipe what has been typed.
  const [seededId, setSeededId] = useState<string | null>(null);
  if (row && seededId !== row.guestId) {
    setSeededId(row.guestId);
    setAmount(row.amountPaid ? String(row.amountPaid) : '');
    setNote(row.note ?? '');
    setFinished(row.amountPaid > 0 ? row.status === 'PAID' : null);
    const seedName = row.pendingEdit?.name ?? row.name ?? '';
    const seedPhone = row.pendingEdit?.phone ?? row.phone ?? '';
    setName(seedName);
    setPhone(seedPhone);
    setDetailSeed({ name: seedName, phone: seedPhone });
  }

  const paid = Number(amount.replace(/[^\d]/g, '')) || 0;
  const canRecord = paid > 0 && finished !== null;
  const detailsDirty = !!row && (name !== detailSeed.name || phone !== detailSeed.phone);
  const canSave = canRecord || detailsDirty;
  const expected = row?.amountExpected ?? null;
  const coversExpected = expected !== null && paid >= expected;
  const remaining = row ? remainingOf(row) : 0;
  const meta = row ? CONTRIBUTION_STATUS_META[row.status] : null;

  const copyPhone = async () => {
    if (!row?.phone) return;
    try {
      await navigator.clipboard.writeText(row.phone);
      toast.success('Number copied');
    } catch {
      toast.error('Could not copy the number');
    }
  };

  /**
   * One Save button for the sheet. Money records itself straight away;
   * changed details are never applied from here — the visitor is asked first,
   * and the proposal goes to the event planner to accept or decline.
   */
  const submit = () => {
    if (!row) return;
    if (detailsDirty && !name.trim()) {
      toast.error('Name cannot be empty.');
      return;
    }
    void (async () => {
      if (detailsDirty) {
        const goAhead = await confirmToast({
          title: 'Send these details to the event planner?',
          message:
            'Your name and number will only change once the event planner accepts the request.',
          confirmText: 'Send for approval',
        });
        if (!goAhead) return;
      }
      const ok = await onSave({
        record: canRecord && finished !== null
          ? { amountPaid: paid, finished, note: note.trim() }
          : null,
        details: detailsDirty && name.trim()
          ? { name: name.trim(), phone: phone.trim() }
          : null,
      });
      if (!ok) return;
    })();
  };

  return (
    <AppBottomSheet
      open={!!row}
      onClose={onClose}
      title={row?.guestName}
      description={
        row && meta
          ? `${meta.label}${expected ? ` · expected ${formatTZS(expected, currency)}` : ''}`
          : undefined
      }
      footer={
        row ? (
          <div className="flex gap-2">
            <AppButton variant="ghost" onClick={onClose} fullWidth>
              Cancel
            </AppButton>
            <AppButton
              onClick={submit}
              loading={saving}
              loadingText="Saving"
              disabled={!canSave}
              fullWidth
              data-autofocus
            >
              Save
            </AppButton>
          </div>
        ) : null
      }
    >
      {row ? (
        <div className="space-y-5">
          {/* ── Full details ── */}
          <section className="rounded-card border border-line bg-surface-2 p-3.5">
            <div className="flex items-center gap-3">
              <AppAvatar name={row.guestName} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-[15px] font-semibold leading-snug text-ink">
                  {row.guestName}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <AppChip tone={STATUS_TONE[row.status]}>{meta?.label}</AppChip>
                  {row.updatedAt ? (
                    <span className="text-[11px] text-muted">
                      Updated {formatDate(row.updatedAt)}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-2">
              <DetailTile
                label="Received"
                value={formatTZS(row.amountPaid, currency)}
                className="text-brand"
              />
              <DetailTile
                label="Expected"
                value={expected ? formatTZS(expected, currency) : 'Not set'}
              />
              <DetailTile
                label="Remaining"
                value={remaining > 0 ? formatTZS(remaining, currency) : 'Nothing left'}
                className={remaining > 0 ? 'text-warn' : 'text-success'}
              />
              <DetailTile
                label="Last updated"
                value={row.updatedAt ? formatDate(row.updatedAt) : 'Not yet'}
              />
            </dl>

            {row.note ? (
              <p className="mt-2.5 break-words text-[12px] italic leading-snug text-muted">
                “{row.note}”
              </p>
            ) : null}
          </section>

          {/* ── Phone: complete, tappable, copyable ── */}
          <section className="rounded-card border border-line bg-white p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Phone number
            </p>
            {row.phone ? (
              <>
                {/* break-all rather than truncate: the whole number is the point. */}
                <p className="mt-1 break-all text-[17px] font-bold leading-tight tabular-nums text-ink">
                  {row.phone}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <a
                    href={`tel:${row.phone}`}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-tap bg-brand text-[13px] font-semibold text-white shadow-brand-sm transition active:bg-brand-800"
                  >
                    <Phone size={14} aria-hidden="true" />
                    Call
                  </a>
                  <button
                    type="button"
                    onClick={() => void copyPhone()}
                    className="flex h-10 items-center justify-center gap-1.5 rounded-tap border border-line bg-surface text-[13px] font-semibold text-ink transition hover:border-brand/40"
                  >
                    <Copy size={14} aria-hidden="true" />
                    Copy
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-1 text-[14px] text-muted">
                No number on file. Propose one below and the event planner can add it.
              </p>
            )}
          </section>

          {/* ── Details the visitor can propose a correction to ── */}
          <section className="rounded-card border border-line bg-white p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Guest details
            </p>

            {row.pendingEdit ? (
              <p className="mt-2 flex items-start gap-2 rounded-tap bg-warn-soft px-3 py-2.5 text-[12px] leading-relaxed text-warn">
                <Hourglass size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  With the event planner — awaiting approval before the list changes.
                </span>
              </p>
            ) : null}

            <div className="mt-3 space-y-3">
              <div>
                <label
                  htmlFor="tracker-name"
                  className="mb-1.5 block text-[13px] font-semibold text-ink"
                >
                  Full name
                </label>
                <input
                  id="tracker-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={120}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-tap border border-line bg-white px-3.5 py-2.5 text-sm text-ink transition-all duration-150 ease-soft placeholder:text-gray-300 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                />
              </div>
              <div>
                <label
                  htmlFor="tracker-phone"
                  className="mb-1.5 block text-[13px] font-semibold text-ink"
                >
                  Phone number
                </label>
                <input
                  id="tracker-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+255712345678"
                  className="w-full rounded-tap border border-line bg-white px-3.5 py-2.5 text-sm tabular-nums text-ink transition-all duration-150 ease-soft placeholder:text-gray-300 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
                />
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                  Include the country code, e.g. +255712345678. Leave empty for no number.
                </p>
              </div>
            </div>

            <p className="mt-3 rounded-tap bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-muted">
              Corrections are sent to the event planner and applied to the guest list only
              once they accept them.
            </p>
          </section>

          {/* ── Record what arrived ── */}
          <div>
            <label
              htmlFor="tracker-amount"
              className="mb-1.5 block text-[13px] font-semibold text-ink"
            >
              How much have you received?
            </label>
            <div className="relative">
              <input
                id="tracker-amount"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                aria-describedby="tracker-amount-hint"
                className="w-full rounded-tap border border-line bg-white px-3.5 py-3 pr-16 text-lg font-semibold tabular-nums text-ink transition-all duration-150 ease-soft placeholder:text-gray-300 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-muted">
                {currency}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <QuickAmountButton
                label={`+${formatTZS(QUICK_ADD, currency)}`}
                onClick={() => setAmount(String(paid + QUICK_ADD))}
              />
              {expected ? (
                <QuickAmountButton
                  label={`Full ${formatTZS(expected, currency)}`}
                  onClick={() => setAmount(String(expected))}
                />
              ) : null}
              {paid > 0 ? (
                <QuickAmountButton label="Clear" onClick={() => setAmount('')} />
              ) : null}
            </div>
            <p id="tracker-amount-hint" className="mt-2 text-[12px] leading-relaxed text-muted">
              The total received from this guest so far, including anything already recorded.
            </p>
          </div>

          {expected !== null ? (
            <p
              className={`flex items-center gap-2 rounded-tap px-3 py-2.5 text-[13px] ${
                coversExpected ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted'
              }`}
            >
              {coversExpected ? <Check size={14} className="shrink-0" /> : <Wallet size={14} className="shrink-0" />}
              <span className="min-w-0 break-words">
                {coversExpected
                  ? `That covers the full ${formatTZS(expected, currency)}.`
                  : `${formatTZS(expected - paid > 0 ? expected - paid : 0, currency)} still expected.`}
              </span>
            </p>
          ) : null}

          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-ink">
              Is the contribution complete?
            </legend>
            <div className="grid gap-2">
              {(
                [
                  {
                    value: true,
                    label: 'Yes, fully received',
                    hint: 'They have paid everything expected.',
                    Icon: CheckCircle2,
                    on: 'border-success bg-success-soft',
                    dot: 'bg-success',
                  },
                  {
                    value: false,
                    label: 'Not yet, more expected',
                    hint: 'Only part of it has come in so far.',
                    Icon: Hourglass,
                    on: 'border-warn bg-warn-soft',
                    dot: 'bg-warn',
                  },
                ] as const
              ).map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => setFinished(option.value)}
                  aria-pressed={finished === option.value}
                  className={`flex items-start gap-3 rounded-tap border p-3 text-left transition ${
                    finished === option.value
                      ? option.on
                      : 'border-line bg-surface hover:border-brand/40'
                  }`}
                >
                  <span
                    className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 ${
                      finished === option.value ? 'border-transparent' : 'border-line'
                    } ${finished === option.value ? option.dot : ''}`}
                  >
                    {finished === option.value ? (
                      <span className="size-1.5 rounded-full bg-white" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                      <option.Icon size={14} className="shrink-0" aria-hidden="true" />
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[12px] leading-snug text-muted">
                      {option.hint}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="tracker-note" className="mb-1.5 block text-[13px] font-semibold text-ink">
              Note <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="tracker-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. bank transfer, 20 Nov"
              className="w-full rounded-tap border border-line bg-white px-3.5 py-2.5 text-sm text-ink transition-all duration-150 ease-soft placeholder:text-gray-300 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
            />
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
              A short reminder for yourself, such as how it arrived or when.
            </p>
          </div>
        </div>
      ) : null}
    </AppBottomSheet>
  );
}

function DetailTile({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="rounded-tap bg-white px-3 py-2 ring-1 ring-inset ring-line">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className={`mt-0.5 break-words text-[13px] font-semibold tabular-nums ${className}`}>
        {value}
      </dd>
    </div>
  );
}

function QuickAmountButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-8 items-center rounded-full bg-surface-2 px-3 text-[12px] font-semibold text-ink transition hover:bg-line"
    >
      {label}
    </button>
  );
}
