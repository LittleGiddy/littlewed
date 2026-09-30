// app/[eventId]/contributions/ContributionTracker.tsx
'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Banknote,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDashed,
  Loader2,
  MapPin,
  MessageCircle,
  PartyPopper,
  RefreshCw,
  Users,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  CONTRIBUTION_STATUSES,
  formatTZS,
  type ContributionStatus,
} from '@/lib/contributions';

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
  id: string;
  guestId: string;
  guestName: string;
  phone: string;
  status: ContributionStatus;
  amountPaid: number;
  amountExpected: number | null;
  note: string | null;
  updatedAt: string;
}

interface TrackerSummary {
  total: number;
  pending: number;
  partial: number;
  paid: number;
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

const STATUS_META: Record<
  ContributionStatus,
  { label: string; labelSw: string; icon: typeof Check; chip: string; dot: string }
> = {
  PENDING: {
    label: 'Not started',
    labelSw: 'Bado',
    icon: CircleDashed,
    chip: 'bg-surface-2 text-muted ring-line',
    dot: 'bg-muted',
  },
  PARTIAL: {
    label: 'Partial',
    labelSw: 'Sehemu',
    icon: RefreshCw,
    chip: 'bg-warn-soft text-warn ring-warn-border',
    dot: 'bg-warn',
  },
  PAID: {
    label: 'Completed',
    labelSw: 'Imekamilika',
    icon: Check,
    chip: 'bg-success-soft text-success ring-success-border',
    dot: 'bg-success',
  },
};

function initials(name: string): string {
  const parts = name.replace(/^(mr|mrs|miss|ms|dr|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
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
  const [filter, setFilter] = useState<'ALL' | ContributionStatus>('ALL');
  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [draftAmount, setDraftAmount] = useState('');
  const [draftNote, setDraftNote] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const currency = data.event.currency || data.summary.currency || 'TZS';

  const setStatus = useCallback(
    async (row: TrackerRow, status: ContributionStatus) => {
      if (row.status === status) return;
      setSavingId(row.id);
      const previous = data;
      // Optimistic: this is a one-tap action on a phone and the network round
      // trip is slow enough that waiting makes it feel broken.
      setData((cur) => ({
        ...cur,
        rows: cur.rows.map((r) => (r.id === row.id ? { ...r, status } : r)),
      }));
      try {
        const res = await fetch(`/api/public/events/${eventId}/contributions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId: row.guestId, status }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || 'Could not save');
        setData((cur) => ({
          ...cur,
          summary: payload.summary,
          rows: payload.rows,
        }));
        toast.success(
          status === 'PAID' ? `${row.guestName} marked completed` : `${row.guestName} updated`
        );
      } catch (error) {
        setData(previous);
        toast.error(error instanceof Error ? error.message : 'Could not save');
      } finally {
        setSavingId(null);
      }
    },
    [data, eventId]
  );

  const saveAmounts = useCallback(
    async (row: TrackerRow) => {
      const amountPaid = Number(draftAmount.replace(/[^\d]/g, '')) || 0;
      setSavingId(row.id);
      try {
        const res = await fetch(`/api/public/events/${eventId}/contributions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guestId: row.guestId,
            amountPaid,
            note: draftNote.trim() || undefined,
          }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || 'Could not save');
        setData((cur) => ({ ...cur, summary: payload.summary, rows: payload.rows }));
        setExpandedId(null);
        setDraftAmount('');
        setDraftNote('');
        toast.success('Amount recorded');
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Could not save');
      } finally {
        setSavingId(null);
      }
    },
    [draftAmount, draftNote, eventId]
  );

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/public/events/${eventId}/contributions`);
      if (!res.ok) throw new Error('Could not refresh');
      const payload = await res.json();
      setData(payload);
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

  const counts = {
    ALL: data.rows.length,
    PENDING: data.summary.pending,
    PARTIAL: data.summary.partial,
    PAID: data.summary.paid,
  } as const;

  const occasion = data.event.eventType || data.event.name;

  return (
    <div className="min-h-dvh bg-canvas pb-16">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="relative overflow-hidden bg-brand text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 12%, #ffffff 0, transparent 42%), radial-gradient(circle at 88% 82%, #7fb5b4 0, transparent 46%)',
          }}
        />
        <div className="relative mx-auto w-full max-w-3xl px-5 pb-10 pt-12 sm:px-8 sm:pt-16">
          <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-200">
            <PartyPopper className="size-3.5" aria-hidden="true" />
            Contribution tracker
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight sm:text-4xl">
            {occasion}
          </h1>
          <p className="mt-2 text-sm text-brand-100">
            {data.event.hostFamily || data.event.name}
          </p>

          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-card bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15">
              <dt className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-wide text-brand-200">
                <CalendarClock className="size-3.5" aria-hidden="true" />
                Event date
              </dt>
              <dd className="mt-1 text-sm font-semibold">{data.event.date}</dd>
            </div>
            <div className="rounded-card bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15">
              <dt className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-wide text-brand-200">
                <Wallet className="size-3.5" aria-hidden="true" />
                Pay before
              </dt>
              <dd className="mt-1 text-sm font-semibold">{data.event.deadline}</dd>
            </div>
            <div className="rounded-card bg-white/10 px-4 py-3 ring-1 ring-inset ring-white/15">
              <dt className="flex items-center gap-1.5 text-[0.7rem] uppercase tracking-wide text-brand-200">
                <MapPin className="size-3.5" aria-hidden="true" />
                Venue
              </dt>
              <dd className="mt-1 truncate text-sm font-semibold">
                {data.event.venue || data.event.address || '—'}
              </dd>
            </div>
          </dl>
        </div>
      </header>

      <main className="mx-auto -mt-6 w-full max-w-3xl space-y-6 px-5 sm:px-8">
        {/* ── Progress ─────────────────────────────────────────────── */}
        <section className="rounded-card bg-surface p-5 shadow-card sm:p-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
                Collected
              </p>
              <p className="mt-1 font-display text-2xl leading-none sm:text-3xl">
                {formatTZS(data.summary.collected, currency)}
              </p>
            </div>
            {data.summary.target ? (
              <div className="text-right">
                <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
                  Target
                </p>
                <p className="mt-1 text-sm font-semibold">
                  {formatTZS(data.summary.target, currency)}
                </p>
              </div>
            ) : null}
          </div>

          {progressPct !== null ? (
            <div className="mt-4">
              <div
                className="h-2.5 overflow-hidden rounded-full bg-brand-50"
                role="progressbar"
                aria-valuenow={progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Contribution progress"
              >
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-muted">
                {progressPct}% of target · {formatTZS(data.summary.outstanding, currency)}{' '}
                outstanding
              </p>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {(
              [
                { key: 'PENDING' as const, label: 'Not started', value: data.summary.pending },
                { key: 'PARTIAL' as const, label: 'Partial', value: data.summary.partial },
                { key: 'PAID' as const, label: 'Completed', value: data.summary.paid },
              ]
            ).map((s) => (
              <div key={s.key} className="rounded-tap bg-surface-2 px-2 py-3">
                <p className="font-display text-xl leading-none">{s.value}</p>
                <p className="mt-1 text-[0.68rem] uppercase tracking-wide text-muted">
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Payment instructions ─────────────────────────────────── */}
        {data.event.mpesaInstructions || data.event.airtelInstructions || data.event.bankInstructions ? (
          <section className="rounded-card bg-surface p-5 shadow-card sm:p-6">
            <h2 className="flex items-center gap-2 font-display text-lg">
              <Banknote className="size-4 text-brand" aria-hidden="true" />
              How to send your contribution
            </h2>
            <ul className="mt-4 space-y-2.5">
              {(
                [
                  ['M-Pesa', data.event.mpesaInstructions],
                  ['Airtel Money', data.event.airtelInstructions],
                  ['Bank', data.event.bankInstructions],
                ] as const
              ).map(([label, value]) =>
                value ? (
                  <li
                    key={label}
                    className="flex flex-col gap-0.5 rounded-tap bg-brand-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <span className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                      {label}
                    </span>
                    <span className="text-sm font-medium text-ink sm:text-right">{value}</span>
                  </li>
                ) : null
              )}
            </ul>
          </section>
        ) : null}

        {/* ── Guest list ──────────────────────────────────────────── */}
        <section className="rounded-card bg-surface shadow-card">
          <div className="space-y-4 border-b border-line p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-lg">
                <Users className="size-4 text-brand" aria-hidden="true" />
                Who has contributed
              </h2>
              <button
                type="button"
                onClick={refresh}
                disabled={refreshing}
                className="grid size-9 place-items-center rounded-tap text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              </button>
            </div>

            <label className="block">
              <span className="sr-only">Search by name or number</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or number"
                className="h-11 w-full rounded-tap border border-line bg-surface-2 px-4 text-sm outline-none transition-colors placeholder:text-muted focus:border-brand-300 focus:bg-surface"
              />
            </label>

            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
              {(['ALL', ...CONTRIBUTION_STATUSES] as const).map((key) => {
                const meta = key === 'ALL' ? null : STATUS_META[key];
                const active = filter === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    aria-pressed={active}
                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-brand text-white'
                        : 'bg-surface-2 text-muted ring-1 ring-inset ring-line hover:text-ink'
                    }`}
                  >
                    {meta ? <meta.icon className="size-3.5" aria-hidden="true" /> : null}
                    {key === 'ALL' ? 'All' : meta?.label}
                    <span className={active ? 'text-white/70' : 'text-muted'}>{counts[key]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {visibleRows.length === 0 ? (
            <p className="px-6 py-14 text-center text-sm text-muted">
              {data.rows.length === 0
                ? 'No contributions recorded yet.'
                : 'No one matches this filter.'}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {visibleRows.map((row) => {
                const meta = STATUS_META[row.status];
                const isExpanded = expandedId === row.id;
                const saving = savingId === row.id;
                return (
                  <li key={row.id} className="px-5 py-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700"
                      >
                        {initials(row.guestName)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{row.guestName}</p>
                        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                          <span className="tabular-nums">{row.phone}</span>
                          {row.amountExpected ? (
                            <span className="hidden sm:inline">
                              · of {formatTZS(row.amountExpected, currency)}
                            </span>
                          ) : null}
                        </p>
                      </div>

                      <span
                        className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ring-1 ring-inset sm:inline-flex ${meta.chip}`}
                      >
                        <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                        {meta.label}
                      </span>
                    </div>

                    {/* Amount line */}
                    {row.amountPaid > 0 || row.amountExpected ? (
                      <p className="mt-2.5 pl-[3.25rem] text-xs text-muted">
                        <span className="font-semibold text-ink">
                          {formatTZS(row.amountPaid, currency)}
                        </span>
                        {row.amountExpected ? (
                          <>
                            {' '}
                            received
                            {row.amountPaid < row.amountExpected ? (
                              <>
                                {' · '}
                                {formatTZS(row.amountExpected - row.amountPaid, currency)}{' '}
                                remaining
                              </>
                            ) : null}
                          </>
                        ) : (
                          ' received'
                        )}
                      </p>
                    ) : null}

                    {row.note ? (
                      <p className="mt-1.5 pl-[3.25rem] text-xs italic text-muted">
                        “{row.note}”
                      </p>
                    ) : null}

                    {/* Status control */}
                    <div className="mt-3 grid grid-cols-3 gap-2 pl-[3.25rem]">
                      {CONTRIBUTION_STATUSES.map((status) => {
                        const sMeta = STATUS_META[status];
                        const SIcon = sMeta.icon;
                        const isActive = row.status === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setStatus(row, status)}
                            disabled={saving}
                            aria-pressed={isActive}
                            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-tap px-2 py-2 text-xs font-semibold transition-all disabled:opacity-60 ${
                              isActive
                                ? 'bg-brand text-white shadow-sm'
                                : 'bg-surface-2 text-muted ring-1 ring-inset ring-line hover:text-ink'
                            }`}
                          >
                            {saving && isActive ? (
                              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <SIcon className="size-3.5" aria-hidden="true" />
                            )}
                            {sMeta.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Amount editor */}
                    <button
                      type="button"
                      onClick={() => {
                        setExpandedId(isExpanded ? null : row.id);
                        setDraftAmount(row.amountPaid ? String(row.amountPaid) : '');
                        setDraftNote(row.note ?? '');
                      }}
                      aria-expanded={isExpanded}
                      className="mt-2 flex min-h-9 items-center gap-1.5 pl-[3.25rem] text-xs font-semibold text-brand-600 hover:text-brand"
                    >
                      <ChevronDown
                        className={`size-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                      {isExpanded ? 'Close' : 'Record an amount'}
                    </button>

                    {isExpanded ? (
                      <div className="mt-3 space-y-3 rounded-tap bg-surface-2 p-4 pl-[3.25rem]">
                        <label className="block">
                          <span className="text-xs font-semibold text-ink">
                            Amount received ({currency})
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={draftAmount}
                            onChange={(e) => setDraftAmount(e.target.value)}
                            placeholder="0"
                            className="mt-1.5 h-11 w-full rounded-tap border border-line bg-surface px-3.5 text-sm tabular-nums outline-none focus:border-brand-300"
                          />
                        </label>
                        <label className="block">
                          <span className="text-xs font-semibold text-ink">Note (optional)</span>
                          <input
                            type="text"
                            value={draftNote}
                            onChange={(e) => setDraftNote(e.target.value)}
                            placeholder="e.g. sent via M-Pesa"
                            maxLength={200}
                            className="mt-1.5 h-11 w-full rounded-tap border border-line bg-surface px-3.5 text-sm outline-none focus:border-brand-300"
                          />
                        </label>
                        <p className="text-[0.7rem] leading-relaxed text-muted">
                          Reaching the expected amount marks this guest completed automatically.
                        </p>
                        <button
                          type="button"
                          onClick={() => saveAmounts(row)}
                          disabled={saving}
                          className="inline-flex min-h-11 items-center gap-2 rounded-tap bg-brand px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          {saving ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Check className="size-4" aria-hidden="true" />
                          )}
                          Save
                        </button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ── Footer ──────────────────────────────────────────────── */}
        <footer className="flex flex-col items-center gap-3 rounded-card bg-surface-2 px-5 py-6 text-center">
          <p className="flex items-center gap-2 text-xs text-muted">
            <MessageCircle className="size-3.5" aria-hidden="true" />
            Statuses update instantly for everyone with this link.
          </p>
          <p className="text-[0.68rem] text-muted">
            Phone numbers are hidden for privacy. Contact numbers on the cards above are the
            official channels.
          </p>
        </footer>
      </main>
    </div>
  );
}
