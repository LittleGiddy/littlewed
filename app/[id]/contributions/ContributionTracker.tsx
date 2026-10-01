// app/[id]/contributions/ContributionTracker.tsx
//
// Public, shared contribution tracker. Anyone with the link can open it and
// update their own status, so this screen is deliberately read-mostly: it shows
// the progress of the whole event but only ever edits the row a guest taps.
//
// Visual language is shared with the tenant-side manager (widgets.tsx) so the
// two do not drift apart, but there is no settings screen and no share control
// here — there is nothing for a guest to configure and no second audience to
// share with.
'use client';

import { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Banknote,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  Hourglass,
  Loader2,
  MapPin,
  MessageCircle,
  PartyPopper,
  Phone,
  RefreshCw,
  Search,
  Smartphone,
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
  name: string;
  eventType: string | null;
  date: string;
  venue: string | null;
  address: string | null;
  hostFamily: string | null;
  person1: string | null;
  person2: string | null;
  currency: string;
  target: number | null;
  mpesaInstructions: string | null;
  airtelInstructions: string | null;
  bankInstructions: string | null;
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
   * keeps a guest's optimistic tap from leaving the headline numbers stale.
   */
  const patch = useCallback(
    async (
      row: TrackerRow,
      body: Record<string, unknown>,
      successMessage: string
    ) => {
      setSavingId(row.guestId);
      const previous = data;
      // Optimistic: one tap on a phone over a slow connection should not feel
      // like it did nothing.
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
   * A guest's update is one action, not two.
   *
   * Previously the row had three status buttons *and* a separate amount editor,
   * so the two could disagree: tapping "Completed" recorded no figure, and the
   * collected total stayed where it was. Now a guest states how much they sent
   * and whether that was everything, in a single pass, and the server
   * reconciles the status from the two (see reconcileContribution).
   */
  const recordContribution = useCallback(
    async (row: TrackerRow, amountPaid: number, finished: boolean, note: string) => {
      const ok = await patch(
        row,
        { amountPaid, status: finished ? 'PAID' : 'PARTIAL', note: note.trim() || undefined },
        finished
          ? `Asante, ${firstName(row.guestName)}! Marked as completed`
          : `Thank you, ${firstName(row.guestName)}. Recorded as part payment`
      );
      return ok;
    },
    [patch]
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

  const occasion = data.event.eventType || data.event.name;
  // Flattened into plain objects rather than a filtered tuple array: narrowing
  // a `readonly ['Bank', string | null, Icon]` union needs a per-entry predicate.
  const instructions = [
    { label: 'M-Pesa', value: data.event.mpesaInstructions, Icon: Smartphone },
    { label: 'Airtel Money', value: data.event.airtelInstructions, Icon: Phone },
    { label: 'Bank', value: data.event.bankInstructions, Icon: Banknote },
  ].filter((entry): entry is { label: string; value: string; Icon: typeof Banknote } =>
    Boolean(entry.value)
  );

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
              Contribution tracker
            </p>
            <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">{occasion}</h1>
            {data.event.hostFamily || data.event.name ? (
              <p className="mt-2 text-sm text-brand-100">
                {data.event.hostFamily || data.event.name}
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
            {            [
              {
                icon: CalendarClock,
                label: 'Event date',
                value: data.event.date,
              },
              {
                icon: MapPin,
                label: 'Venue',
                value: data.event.venue || data.event.address || '—',
              },
            ].map((item) => (
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
                    ? ` · ${formatTZS(data.summary.outstanding, currency)} still owed`
                    : ' · nothing outstanding'}
                </p>
              ) : null}
            </div>
          </div>
        </AppCard>

        {/* ── How to pay ──────────────────────────────────────────────────── */}
        {instructions.length ? (
          <AppCard>
            <AppCardTitle
              title="How to send your contribution"
              subtitle="Tap any instruction to copy it."
            />
            <ul className="mt-3 space-y-2">
              {instructions.map(({ label, value, Icon }, i) => (
                <motion.li
                  key={label}
                  initial={reducedInitial(transition)}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...transition, delay: i * 0.05 }}
                >
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(value);
                        toast.success(`${label} details copied`);
                      } catch {
                        toast.error('Could not copy on this device');
                      }
                    }}
                    className="flex w-full items-start gap-3 rounded-tap bg-surface-2 px-3.5 py-3 text-left transition active:scale-[0.99]"
                  >
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-blob bg-brand/10 text-brand">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.68rem] font-semibold uppercase tracking-wide text-brand-600">
                        {label}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-ink">
                        {value}
                      </span>
                    </span>
                    <Copy size={14} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
                  </button>
                </motion.li>
              ))}
            </ul>
          </AppCard>
        ) : null}

        {/* ── Guest list ──────────────────────────────────────────────────── */}
        <AppCard padded={false}>
          <div className="space-y-3 border-b border-line p-4">
            <div className="flex items-center justify-between gap-3">
              <AppCardTitle
                title="Who has contributed"
                subtitle="Tap a status to update your own. Everyone sees the change immediately."
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
                { value: 'PARTIAL', label: `Partial ${data.summary.partial}` },
                { value: 'PAID', label: `Done ${data.summary.paid}` },
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
                placeholder="Search name or number"
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
                  : 'Try a different name, number, or status filter.'
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
          <div className="space-y-2 text-center">
            <p className="flex items-center justify-center gap-2 text-[13px] font-medium text-ink">
              <MessageCircle size={14} className="text-brand" aria-hidden="true" />
              Updates here show instantly for everyone with this link.
            </p>
            <p className="text-[11px] leading-relaxed text-muted">
              Phone numbers are hidden for privacy. The payment details above are the official
              channels — please pay only through those.
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

function firstName(full: string): string {
  const cleaned = full.replace(/^(mr|mrs|miss|ms|dr|prof)\.?\s+/i, '');
  return cleaned.split(/\s+/)[0] || full;
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

        {/* One action, one meaning. A guest answers "how much did you send, and
            is that all?" in a single sheet rather than picking a status from a
            row of buttons that knows nothing about the figure. */}
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
          {recorded ? 'Update my contribution' : 'I have sent my contribution'}
        </motion.button>
      </div>
    </div>
  );
}

/**
 * "How much did you send, and is that everything?"
 *
 * One sheet answers both, because splitting them across two controls is what
 * let a guest tick "Completed" without a figure and leave the collected total
 * unchanged. The amount comes first and the yes/no finishes it, so the status
 * always has a number attached to it.
 *
 * Guests record what they sent but cannot set the figure they are expected to
 * pay — that is the tenant's number, and a shared link must not be able to move
 * the target.
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
  // null until the guest answers, so the sheet never presumes "finished" on
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
      title="Record your contribution"
      description={
        row
          ? `${row.guestName}${expected ? ` · the full amount is ${formatTZS(expected, currency)}` : ''}`
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
              How much did you send?
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
              Enter the amount you have already sent, not what you still owe.
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
                : `${formatTZS(expected - paid > 0 ? expected - paid : 0, currency)} still to go.`}
            </p>
          ) : null}

          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-gray-700">
              Have you finished contributing?
            </legend>
            <div className="grid gap-2">
              {(
                [
                  {
                    value: true,
                    label: 'Yes, that is everything',
                    hint: 'I have sent the full amount.',
                    Icon: CheckCircle2,
                    on: 'border-success bg-success-soft',
                    dot: 'bg-success',
                  },
                  {
                    value: false,
                    label: 'Not yet, I will send more',
                    hint: 'I have sent part of it so far.',
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
              placeholder="e.g. sent via M-Pesa this morning"
              className="w-full rounded-tap border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 transition-all duration-150 ease-soft placeholder:text-gray-300 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
            />
            <p className="mt-1.5 text-[12px] leading-relaxed text-gray-400">
              Anything the organisers should know, such as which method you used.
            </p>
          </div>
        </div>
      ) : null}
    </AppBottomSheet>
  );
}
