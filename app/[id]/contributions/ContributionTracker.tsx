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
  Copy,
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
  CONTRIBUTION_STATUSES,
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
  deadline: string;
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

const STATUS_BG: Record<ContributionStatus, string> = {
  PENDING: 'bg-muted',
  PARTIAL: 'bg-warn',
  PAID: 'bg-success',
};

const STATUS_DOT: Record<ContributionStatus, string> = {
  PENDING: 'bg-muted',
  PARTIAL: 'bg-warn',
  PAID: 'bg-success',
};

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

  const setStatus = useCallback(
    (row: TrackerRow, status: ContributionStatus) => {
      if (row.status === status) return;
      void patch(
        row,
        { status },
        status === 'PAID' ? `Asante, ${firstName(row.guestName)}! Marked completed` : 'Updated'
      );
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
            className="mt-6 grid gap-2.5 sm:grid-cols-3"
            initial="hidden"
            animate="shown"
            variants={{
              hidden: {},
              shown: { transition: { staggerChildren: reduced ? 0 : 0.06 } },
            }}
          >
            {[
              {
                icon: CalendarClock,
                label: 'Event date',
                value: data.event.date,
              },
              {
                icon: Wallet,
                label: 'Pay before',
                value: data.event.deadline,
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
                      onSetStatus={(status) => setStatus(row, status)}
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

      <AmountSheet
        row={editing}
        currency={currency}
        saving={savingId === editing?.guestId}
        onClose={() => setEditing(null)}
        onSave={async (amountPaid, note) => {
          if (!editing) return false;
          const ok = await patch(
            editing,
            { amountPaid, note: note.trim() || undefined },
            'Asante, contribution recorded'
          );
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
  onSetStatus,
}: {
  row: TrackerRow;
  currency: string;
  busy: boolean;
  onOpen: () => void;
  onSetStatus: (status: ContributionStatus) => void;
}) {
  const transition = useTransition();
  const [tapped, setTapped] = useState<ContributionStatus | null>(null);
  const meta = CONTRIBUTION_STATUS_META[row.status];

  const press = (status: ContributionStatus) => {
    setTapped(status);
    // Cleared on the next tick so the pulse reads as feedback on the button
    // rather than as a stuck loading state if the request is slow.
    window.setTimeout(() => setTapped(null), 320);
    onSetStatus(status);
  };

  const remaining =
    row.amountExpected && row.amountExpected > row.amountPaid
      ? row.amountExpected - row.amountPaid
      : 0;

  return (
    <>
      <div className="flex items-start gap-3">
        <AppAvatar name={row.guestName} size="md" />
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold text-ink">{row.guestName}</span>
            <AppChip
              tone={row.status === 'PAID' ? 'success' : row.status === 'PARTIAL' ? 'warn' : 'neutral'}
            >
              {meta.label}
            </AppChip>
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-muted">
            {row.phone}
            {row.updatedAt
              ? ` · updated ${new Date(row.updatedAt).toLocaleDateString()}`
              : ' · not tracked yet'}
          </span>
          {row.amountPaid > 0 || row.amountExpected ? (
            <span className="mt-1 block text-[12px] tabular-nums text-ink">
              {formatTZS(row.amountPaid, currency)} received
              {remaining > 0 ? (
                <span className="text-muted"> · {formatTZS(remaining, currency)} remaining</span>
              ) : null}
            </span>
          ) : null}
        </button>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {CONTRIBUTION_STATUSES.map((status) => {
          const on = row.status === status;
          const spinning = busy && on;
          return (
            <motion.button
              key={status}
              type="button"
              whileTap={{ scale: 0.96 }}
              transition={transition}
              disabled={busy}
              aria-pressed={on}
              aria-label={`Mark ${row.guestName} as ${CONTRIBUTION_STATUS_META[status].label}`}
              onClick={() => press(status)}
              className={`relative flex h-9 items-center justify-center gap-1 overflow-hidden rounded-tap text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                on ? 'text-white' : 'bg-surface-2 text-muted hover:text-ink'
              }`}
            >
              {on ? (
                <motion.span
                  layoutId={`tracker-row-bg-${row.guestId}`}
                  className={`absolute inset-0 ${STATUS_BG[status]}`}
                  transition={transition}
                />
              ) : null}
              {tapped === status ? (
                <motion.span
                  className="absolute inset-0 bg-white/25"
                  initial={{ opacity: 0.9 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.32 }}
                />
              ) : null}
              <span className="relative z-10 inline-flex items-center gap-1">
                {spinning ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <span
                    className={`size-1.5 rounded-full ${on ? 'bg-white/80' : STATUS_DOT[status]}`}
                  />
                )}
                {CONTRIBUTION_STATUS_META[status].label}
              </span>
            </motion.button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-2 flex min-h-9 items-center gap-1.5 text-[12px] font-semibold text-brand-600 hover:text-brand"
      >
        <Wallet size={13} aria-hidden="true" />
        {row.amountPaid > 0 || row.note ? 'Edit amount or note' : 'Record an amount you sent'}
      </button>
    </>
  );
}

/**
 * Amount + note editor. Guests can record what they have sent but not the
 * figure they are expected to pay — that is the tenant's number, and letting a
 * shared link rewrite it would let anyone move the target.
 */
function AmountSheet({
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
  onSave: (amountPaid: number, note: string) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  // Re-seed during render rather than in an effect so opening a guest never
  // shows the previous guest's figures for a frame.
  const [seededId, setSeededId] = useState<string | null>(null);
  if (row && seededId !== row.guestId) {
    setSeededId(row.guestId);
    setAmount(row.amountPaid ? String(row.amountPaid) : '');
    setNote(row.note ?? '');
  }

  const paid = Number(amount.replace(/[^\d]/g, '')) || 0;
  const dirty =
    amount !== (row?.amountPaid ? String(row.amountPaid) : '') || note !== (row?.note ?? '');

  return (
    <AppBottomSheet
      open={!!row}
      onClose={onClose}
      title={row?.guestName}
      description={
        row
          ? `${row.phone}${row.amountExpected ? ` · expected ${formatTZS(row.amountExpected, currency)}` : ''}`
          : undefined
      }
      footer={
        row ? (
          <div className="flex gap-2">
            <AppButton variant="ghost" onClick={onClose} fullWidth>
              Cancel
            </AppButton>
            <AppButton
              onClick={() => void onSave(paid, note)}
              loading={saving}
              loadingText="Saving"
              disabled={!dirty}
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
        <div className="space-y-4">
          <AppInput
            label={`Amount you sent (${currency})`}
            hint="Leave 0 if you have not sent anything yet."
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />

          <AppInput
            label="Note (optional)"
            hint="Anything the organisers should know, e.g. which method you used."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="e.g. sent via M-Pesa this morning"
          />

          {row.amountExpected && paid >= row.amountExpected ? (
            <p className="flex items-center gap-2 rounded-tap bg-success-soft px-3 py-2.5 text-[13px] text-success">
              <Check size={14} />
              This will be marked completed automatically.
            </p>
          ) : null}
        </div>
      ) : null}
    </AppBottomSheet>
  );
}
