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
// Visual language is shared with the tenant-side manager (widgets.tsx) so the
// two screens do not drift apart.
'use client';

import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Hourglass,
  Loader2,
  MapPin,
  PartyPopper,
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
  AppSegmentedControl,
} from '@/components/ui';
import {
  CONTRIBUTION_STATUS_META,
  formatTZS,
  type ContributionStatus,
} from '@/lib/contributions';
import { motionEase, useReducedMotion, useTransition } from '@/lib/motion';
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
  hostFamily: string | null;
  currency: string;
  target: number | null;
}

interface TrackerRow {
  /** Empty for a guest who has no Contribution row yet. */
  id: string;
  guestId: string;
  guestName: string;
  /** Masked server-side. Never the full number. */
  phone: string;
  status: ContributionStatus;
  amountPaid: number;
  amountExpected: number | null;
  note: string | null;
  updatedAt: string | null;
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

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (filter !== 'ALL' && r.status !== filter) return false;
      if (!q) return true;
      return r.guestName.toLowerCase().includes(q) || r.phone.includes(q);
    });
  }, [data.rows, filter, query]);

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

  return (
    <div className="min-h-dvh bg-canvas pb-16">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-brand pb-14 pt-12 text-white sm:pb-16 sm:pt-16">
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
        <div className="relative mx-auto w-full max-w-3xl px-5 sm:px-8">
          <motion.div
            initial={reducedInitial(transition)}
            animate={{ opacity: 1, y: 0 }}
            transition={transition}
          >
            <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-200">
              <PartyPopper className="size-3.5" aria-hidden="true" />
              Contributions
            </p>
            {/* The event's own name from Event Details. */}
            <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">{eventName}</h1>
            {data.event.eventType || data.event.hostFamily ? (
              <p className="mt-2 text-sm text-brand-100">
                {[data.event.eventType, data.event.hostFamily].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </motion.div>

          <motion.dl
            className="mt-6 grid gap-2.5 sm:grid-cols-2"
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
                className="rounded-card bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15"
              >
                <dt className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-wide text-brand-200">
                  <item.icon className="size-3.5" aria-hidden="true" />
                  {item.label}
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold">{item.value}</dd>
              </motion.div>
            ))}
          </motion.dl>
        </div>
      </header>

      <main className="relative mx-auto -mt-8 w-full max-w-3xl space-y-4 px-5 sm:px-8">
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
                <p className="mt-3 text-center text-[12px] text-muted sm:text-left">
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
            <div className="flex items-center justify-between gap-3">
              <AppCardTitle
                title="Guest contributions"
                subtitle="Tap a guest to record what you have received from them."
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

            <AppSegmentedControl
              label="Filter contributions by status"
              value={filter}
              onChange={(v) => setFilter(v as Filter)}
              options={[
                { value: 'ALL', label: `All ${data.summary.total}` },
                { value: 'PENDING', label: `Not started ${data.summary.pending}` },
                { value: 'PARTIAL', label: `Part paid ${data.summary.partial}` },
                { value: 'PAID', label: `Completed ${data.summary.paid}` },
              ]}
            />

            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <AppInput
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by guest name"
                aria-label="Search guests"
                className="pl-9"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2"
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>
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
                  : 'Try a different name or status filter.'
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
                    className="px-4 py-3"
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
              <CheckCircle2 size={14} className="text-brand" aria-hidden="true" />
              Guests marked completed stop receiving reminders.
            </p>
            <p className="text-[11px] leading-relaxed text-muted">
              Every change here is saved to this event straight away.
            </p>
          </div>
        </AppCard>
      </main>

      <RecordSheet
        row={editing}
        currency={currency}
        saving={savingId === editing?.guestId}
        onClose={() => setEditing(null)}
        onSave={async (amountPaid, finished, note) => {
          if (!editing) return false;
          const ok = await recordContribution(editing, amountPaid, finished, note);
          if (ok) setEditing(null);
          return ok;
        }}
      />
    </div>
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

  const remaining =
    row.amountExpected && row.amountExpected > row.amountPaid
      ? row.amountExpected - row.amountPaid
      : 0;

  const recorded = row.amountPaid > 0 || row.note !== null;

  return (
    <div className="flex items-start gap-3">
      <AppAvatar name={row.guestName} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[14px] font-semibold text-ink">{row.guestName}</span>
          <AppChip
            tone={row.status === 'PAID' ? 'success' : row.status === 'PARTIAL' ? 'warn' : 'neutral'}
          >
            {meta.label}
          </AppChip>
        </div>
        <p className="mt-0.5 truncate text-[12px] text-muted">
          {row.phone}
          {row.updatedAt ? ` · updated ${new Date(row.updatedAt).toLocaleDateString()}` : ''}
        </p>
        {row.amountPaid > 0 || row.amountExpected ? (
          <p className="mt-1 text-[12px] tabular-nums text-ink">
            {formatTZS(row.amountPaid, currency)} received
            {remaining > 0 ? (
              <span className="text-muted"> · {formatTZS(remaining, currency)} remaining</span>
            ) : null}
          </p>
        ) : null}
        {row.note ? (
          <p className="mt-1 text-[12px] italic leading-snug text-muted">“{row.note}”</p>
        ) : null}

        {/* One action, one meaning. The owner answers "how much has come in from
            them, and does that settle it?" in a single sheet rather than picking
            a status from buttons that know nothing about the figure. */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={busy}
          onClick={onOpen}
          className={`mt-2.5 flex h-10 w-full items-center justify-center gap-1.5 rounded-tap px-3 text-[13px] font-semibold transition disabled:opacity-50 ${
            row.status === 'PAID'
              ? 'bg-surface-2 text-ink ring-1 ring-inset ring-line'
              : 'bg-brand text-white shadow-elev-1'
          }`}
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <Wallet size={14} aria-hidden="true" />
          )}
          {recorded ? 'Update received amount' : 'Record contribution received'}
        </motion.button>
      </div>
    </div>
  );
}

/**
 * "How much has come in from them, and does that settle it?"
 *
 * One sheet answers both, because splitting them across two controls is what
 * let a guest be ticked off without a figure and leave the collected total
 * unchanged. The amount comes first and the yes/no finishes it, so the status
 * always has a number attached to it.
 *
 * The figure a guest is expected to pay is not editable here — that is the
 * target the owner set for the event, and a record of what arrived should not be
 * able to move it.
 */
function RecordSheet({
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
  onSave: (amountPaid: number, finished: boolean, note: string) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  // null until the owner answers, so the sheet never presumes "settled" on
  // their behalf — that decision is the whole point of the question.
  const [finished, setFinished] = useState<boolean | null>(null);

  // Re-seed during render rather than in an effect so opening a guest never
  // shows the previous guest's figures for a frame.
  const [seededId, setSeededId] = useState<string | null>(null);
  if (row && seededId !== row.guestId) {
    setSeededId(row.guestId);
    setAmount(row.amountPaid ? String(row.amountPaid) : '');
    setNote(row.note ?? '');
    setFinished(row.amountPaid > 0 ? row.status === 'PAID' : null);
  }

  const paid = Number(amount.replace(/[^\d]/g, '')) || 0;
  const canSave = paid > 0 && finished !== null;
  const expected = row?.amountExpected ?? null;
  const coversExpected = expected !== null && paid >= expected;

  return (
    <AppBottomSheet
      open={!!row}
      onClose={onClose}
      title="Record contribution received"
      description={
        row
          ? `${row.guestName}${expected ? ` · expected ${formatTZS(expected, currency)}` : ''}`
          : undefined
      }
      footer={
        row ? (
          <div className="flex gap-2">
            <AppButton variant="ghost" onClick={onClose} fullWidth>
              Cancel
            </AppButton>
            <AppButton
              onClick={() => finished !== null && void onSave(paid, finished, note)}
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
          <div>
            <label
              htmlFor="tracker-amount"
              className="block text-[13px] font-semibold text-gray-700 mb-1.5"
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
                className="w-full rounded-tap border border-gray-200 bg-white px-3.5 py-3 pr-16 text-lg font-semibold tabular-nums text-gray-900 transition-all duration-150 ease-soft placeholder:text-gray-300 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-gray-400">
                {currency}
              </span>
            </div>
            <p id="tracker-amount-hint" className="mt-1.5 text-[12px] leading-relaxed text-gray-400">
              The total received from this guest so far, including anything already recorded.
            </p>
          </div>

          {expected !== null ? (
            <p
              className={`flex items-center gap-2 rounded-tap px-3 py-2.5 text-[13px] ${
                coversExpected ? 'bg-success-soft text-success' : 'bg-surface-2 text-muted'
              }`}
            >
              {coversExpected ? <Check size={14} /> : <Wallet size={14} />}
              {coversExpected
                ? `That covers the full ${formatTZS(expected, currency)}.`
                : `${formatTZS(expected - paid > 0 ? expected - paid : 0, currency)} still expected.`}
            </p>
          ) : null}

          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-gray-700">
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
                  className={`flex items-start gap-3 rounded-tap border p-3.5 text-left transition ${
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
                      <option.Icon size={14} aria-hidden="true" />
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
            <label
              htmlFor="tracker-note"
              className="block text-[13px] font-semibold text-gray-700 mb-1.5"
            >
              Note <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <input
              id="tracker-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              placeholder="e.g. bank transfer, 20 Nov"
              className="w-full rounded-tap border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 transition-all duration-150 ease-soft placeholder:text-gray-300 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
            />
            <p className="mt-1.5 text-[12px] leading-relaxed text-gray-400">
              A short reminder for yourself, such as how it arrived or when.
            </p>
          </div>
        </div>
      ) : null}
    </AppBottomSheet>
  );
}
