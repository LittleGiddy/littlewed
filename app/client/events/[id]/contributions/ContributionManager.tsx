// app/client/events/[id]/contributions/ContributionManager.tsx
// Tenant-facing contribution tracking.
//
// Three screens rather than one long scroll: Overview for the numbers, Guests
// for the per-person records, Settings for the template and payment details.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  Bell,
  Check,
  ExternalLink,
  LayoutDashboard,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  Settings2,
  SlidersHorizontal,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
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
  AppPageHeader,
  AppSegmentedControl,
  AppSelect,
  ShareLinkButton,
  formatTZS,
  CONTRIBUTION_STATUS_META,
  type ContributionStatus,
} from '@/components/ui';
import { MCHANGO_OCCASIONS } from '@/lib/whatsapp/mchango';
import { useTransition } from '@/lib/motion';
import { buildTiles, ProgressRing, StatTiles } from './widgets';
import type {
  ManagerPayload,
  ManagerRow,
  ManagerSummary,
  Screen,
  SettingsForm,
  StatusFilter,
} from './types';

const EMPTY_SUMMARY: ManagerSummary = {
  total: 0,
  pending: 0,
  partial: 0,
  paid: 0,
  settled: 0,
  outstanding: 0,
  collected: 0,
  target: null,
  currency: 'TZS',
};

const SCREENS: { key: Screen; label: string; icon: typeof Wallet }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'guests', label: 'Guests', icon: Users },
  { key: 'settings', label: 'Settings', icon: Settings2 },
];

/** Only the "Mark full" shortcut knows the expected amount; without one the
 *  quick action adds a round figure instead of guessing a target. */
const QUICK_ADD = 50_000;

export default function ContributionManager({ eventId }: { eventId: string }) {
  const router = useRouter();
  const transition = useTransition();

  const [data, setData] = useState<ManagerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [screen, setScreen] = useState<Screen>('overview');
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ManagerRow | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [form, setForm] = useState<SettingsForm | null>(null);

  const summary = data?.summary ?? EMPTY_SUMMARY;
  const currency = summary.currency || 'TZS';

  const trackerUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/${eventId}/contributions`;
  }, [eventId]);

  // ─── Data ───────────────────────────────────────────────────────────────
  // Pure fetch, no setState: callers apply the result, so the same routine
  // serves the mount effect and the manual retry/refresh buttons.
  const fetchPayload = useCallback(async () => {
    const res = await fetch(`/api/events/${eventId}/contributions`, {
      credentials: 'include',
    });
    if (res.status === 401) {
      router.push('/login');
      return null;
    }
    if (!res.ok) throw new Error('Could not load contributions');
    return (await res.json()) as ManagerPayload;
  }, [eventId, router]);

  const applyPayload = useCallback((payload: ManagerPayload) => {
    setData(payload);
    setError(null);
    setLoading(false);
  }, []);

  const FAILURE = 'Could not load contributions. Check your connection and retry.';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await fetchPayload();
        if (cancelled || !payload) return;
        applyPayload(payload);
      } catch {
        if (cancelled) return;
        setError(FAILURE);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchPayload, applyPayload]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const payload = await fetchPayload();
      if (payload) applyPayload(payload);
    } catch {
      setError(FAILURE);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPayload, applyPayload]);

  // The settings form is seeded from the first successful load, during render
  // rather than in an effect: this avoids a cascading re-render and, more
  // importantly, means a later refresh triggered by a row edit cannot discard
  // whatever the tenant has typed into the settings form.
  const [seeded, setSeeded] = useState<ManagerPayload | null>(null);
  if (data && !form && seeded !== data) {
    setSeeded(data);
    setForm({
      contributionsEnabled: data.event.contributionsEnabled,
      eventType: data.event.eventType ?? '',
      contributionDeadline: data.event.contributionDeadline
        ? data.event.contributionDeadline.slice(0, 10)
        : '',
      contributionTarget: data.event.contributionTarget
        ? String(data.event.contributionTarget)
        : '',
      contributionCurrency: data.event.contributionCurrency || 'TZS',
      mpesaInstructions: data.event.mpesaInstructions ?? '',
      airtelInstructions: data.event.airtelInstructions ?? '',
      bankInstructions: data.event.bankInstructions ?? '',
    });
  }

  // ─── Mutations ──────────────────────────────────────────────────────────
  const patchRow = useCallback(
    async (row: ManagerRow, patch: Record<string, unknown>) => {
      setSavingId(row.guestId);
      try {
        const res = await fetch(`/api/events/${eventId}/contributions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ guestId: row.guestId, ...patch }),
        });
        if (!res.ok) throw new Error('Could not save');
        const payload: ManagerPayload = await res.json();
        setData(payload);
        return payload;
      } catch {
        toast.error('Could not save that change. Try again.');
        return null;
      } finally {
        setSavingId(null);
      }
    },
    [eventId]
  );

  const setStatus = useCallback(
    async (row: ManagerRow, status: ContributionStatus) => {
      if (row.status === status) return;
      const payload = await patchRow(row, { status });
      if (payload) {
        const updated = payload.rows.find((r) => r.guestId === row.guestId);
        if (updated) {
          toast.success(
            updated.status === 'PAID'
              ? `${row.guestName} marked completed`
              : `${row.guestName} marked ${CONTRIBUTION_STATUS_META[updated.status].label.toLowerCase()}`
          );
        }
        // Moving the last outstanding guest to completed should not strand the
        // tenant on a screen that no longer shows them.
        if (status === 'PAID' && filter === 'PAID') setQuery((q) => q);
      }
    },
    [patchRow, filter]
  );

  const saveSettings = useCallback(async () => {
    if (!form) return;
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/events/${eventId}/contributions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settings: {
            contributionsEnabled: form.contributionsEnabled,
            eventType: form.eventType || null,
            contributionDeadline: form.contributionDeadline || null,
            contributionTarget: form.contributionTarget ? Number(form.contributionTarget) : null,
            contributionCurrency: form.contributionCurrency || 'TZS',
            mpesaInstructions: form.mpesaInstructions || null,
            airtelInstructions: form.airtelInstructions || null,
            bankInstructions: form.bankInstructions || null,
          },
        }),
      });
      if (!res.ok) throw new Error('Could not save settings');
      setData(await res.json());
      setForm(null);
      toast.success('Settings saved.');
      setScreen('overview');
    } catch {
      toast.error('Could not save settings.');
    } finally {
      setSavingSettings(false);
    }
  }, [eventId, form]);

  // ─── Derived ────────────────────────────────────────────────────────────
  const progressPct =
    summary.target && summary.target > 0
      ? Math.min(100, Math.round((summary.collected / summary.target) * 100))
      : null;

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.rows ?? []).filter((r) => {
      if (filter !== 'ALL' && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.guestName.toLowerCase().includes(q) ||
        (r.phone ?? '').includes(q) ||
        (r.phoneMasked ?? '').includes(q)
      );
    });
  }, [data?.rows, filter, query]);

  /** Guests who still owe money, worst first - the actionable shortlist. */
  const needsAttention = useMemo(
    () =>
      (data?.rows ?? [])
        .filter((r) => r.status !== 'PAID')
        .sort((a, b) => {
          const aShort = a.amountExpected ? a.amountExpected - a.amountPaid : Infinity;
          const bShort = b.amountExpected ? b.amountExpected - b.amountPaid : Infinity;
          return aShort - bShort || a.guestName.localeCompare(b.guestName);
        })
        .slice(0, 6),
    [data?.rows]
  );

  // ─── States ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas">
        <Loader2 className="size-7 animate-spin text-brand" aria-label="Loading" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6">
        <AppEmptyState
          icon={<Wallet size={22} />}
          title="Could not load contributions"
          description={error ?? 'Something went wrong.'}
          action={
            <AppButton
              onClick={() => {
                setLoading(true);
                void refresh();
              }}
            >
              Try again
            </AppButton>
          }
        />
      </div>
    );
  }

  const event = data.event;

  return (
    <div className="min-h-dvh bg-canvas pb-[calc(4rem+var(--app-nav-safe))]">
      <AppPageHeader
        compact
        eyebrow="Contributions"
        title={event.name}
        description="Track who has paid, and share the tracker with your guests."
        actions={
          <div className="flex items-center gap-2">
            <AppButton
              variant="secondary"
              size="sm"
              icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : undefined} />}
              onClick={() => void refresh()}
              loading={refreshing}
              aria-label="Refresh"
            >
              Refresh
            </AppButton>
            <AppButton
              variant="secondary"
              size="sm"
              icon={<Settings2 size={14} />}
              onClick={() => setScreen('settings')}
            >
              Settings
            </AppButton>
          </div>
        }
      />

      <main className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-10 sm:px-6">
        {!event.contributionsEnabled ? (
          <AppCard tone="tinted" className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <Bell size={16} className="mt-0.5 shrink-0 text-brand" />
              <div>
                <p className="text-[13px] font-semibold text-ink">Tracking is switched off</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">
                  The shared page stays hidden and reminders will keep going to guests who have
                  already paid.
                </p>
              </div>
            </div>
            <AppButton
              size="sm"
              onClick={() => {
                setForm((f) => (f ? { ...f, contributionsEnabled: true } : f));
                setScreen('settings');
              }}
            >
              Turn on tracking
            </AppButton>
          </AppCard>
        ) : null}

        {/* ─── Screen switcher ─── */}
        <div
          role="tablist"
          aria-label="Contribution screens"
          className="grid grid-cols-3 gap-1 rounded-blob bg-surface-2 p-1"
        >
          {SCREENS.map((s) => {
            const active = screen === s.key;
            return (
              <button
                key={s.key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setScreen(s.key)}
                className={`relative flex items-center justify-center gap-1.5 rounded-tap px-3 py-2.5 text-[13px] font-semibold transition-colors ${
                  active ? 'text-white' : 'text-muted hover:text-ink'
                }`}
              >
                {active ? (
                  <motion.span
                    layoutId="contribution-tab"
                    className="absolute inset-0 rounded-tap bg-brand shadow-elev-1"
                    transition={transition}
                  />
                ) : null}
                <s.icon size={14} className="relative z-10" aria-hidden="true" />
                <span className="relative z-10">{s.label}</span>
              </button>
            );
          })}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={screen}
            initial={reducedInitial(transition)}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={transition}
            className="space-y-4"
          >
            {screen === 'overview' ? (
              <OverviewScreen
                summary={summary}
                currency={currency}
                progressPct={progressPct}
                trackerUrl={trackerUrl}
                eventName={event.name}
                needsAttention={needsAttention}
                savingId={savingId}
                onOpenRow={setEditing}
                onSetStatus={setStatus}
                onGoToGuests={() => setScreen('guests')}
              />
            ) : null}

            {screen === 'guests' ? (
              <GuestsScreen
                rows={visibleRows}
                summary={summary}
                filter={filter}
                query={query}
                savingId={savingId}
                enabled={event.contributionsEnabled}
                onFilter={setFilter}
                onQuery={setQuery}
                onOpenRow={setEditing}
                onSetStatus={setStatus}
              />
            ) : null}

            {screen === 'settings' ? (
              <SettingsScreen
                form={form}
                saving={savingSettings}
                onChange={setForm}
                onSave={saveSettings}
                onCancel={() => setScreen('overview')}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </main>

      <GuestEditorSheet
        row={editing}
        currency={currency}
        saving={savingId === editing?.guestId}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (!editing) return;
          const payload = await patchRow(editing, patch);
          if (payload) {
            setEditing(null);
            toast.success(`${editing.guestName} updated`);
          }
        }}
      />
    </div>
  );
}

function reducedInitial(transition: { duration: number }) {
  return transition.duration === 0 ? { opacity: 0 } : { opacity: 0, y: 10 };
}

// ─── Overview ─────────────────────────────────────────────────────────────

interface OverviewProps {
  summary: ManagerSummary;
  currency: string;
  progressPct: number | null;
  trackerUrl: string;
  eventName: string;
  needsAttention: ManagerRow[];
  savingId: string | null;
  onOpenRow: (row: ManagerRow) => void;
  onSetStatus: (row: ManagerRow, status: ContributionStatus) => void;
  onGoToGuests: () => void;
}

function OverviewScreen({
  summary,
  currency,
  progressPct,
  trackerUrl,
  eventName,
  needsAttention,
  savingId,
  onOpenRow,
  onSetStatus,
  onGoToGuests,
}: OverviewProps) {
  return (
    <>
      <AppCard>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-6">
          <ProgressRing
            pct={progressPct ?? (summary.collected > 0 ? 100 : 0)}
            collected={summary.collected}
            target={summary.target}
            currency={currency}
          />
          <div className="w-full min-w-0 flex-1">
            <StatTiles
              tiles={buildTiles({
                collected: summary.collected,
                currency,
                total: summary.total,
                pending: summary.pending,
                partial: summary.partial,
                paid: summary.paid,
                outstanding: summary.outstanding,
              })}
            />
            {progressPct !== null ? (
              <p className="mt-3 text-center text-[12px] text-muted sm:text-left">
                <span className="font-semibold text-ink">{progressPct}%</span> of the target
                collected
                {summary.outstanding > 0
                  ? ` · ${formatTZS(summary.outstanding, currency)} still owed`
                  : ' · nothing outstanding'}
              </p>
            ) : null}
          </div>
        </div>
      </AppCard>

      <AppCard>
        <AppCardTitle
          title="Share the tracker"
          subtitle="Guests can mark their own contribution, or record what they paid you offline."
          action={
            trackerUrl ? (
              <a
                href={trackerUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[13px] font-semibold text-brand"
              >
                Open <ExternalLink size={13} />
              </a>
            ) : null
          }
        />
        {trackerUrl ? (
          <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <ShareLinkButton
              url={trackerUrl}
              title={`${eventName} contributions`}
              text="Track who has completed their contribution."
              label="Share link"
              variant="primary"
              size="md"
            />
            <code className="min-w-0 flex-1 truncate rounded-tap bg-surface-2 px-3 py-2.5 text-[12px] text-muted">
              {trackerUrl}
            </code>
          </div>
        ) : null}
      </AppCard>

      <AppCard>
        <AppCardTitle
          title="Needs a reminder"
          subtitle={
            needsAttention.length
              ? 'The guests with money still outstanding.'
              : 'Everyone has completed their contribution.'
          }
          action={
            <button
              type="button"
              onClick={onGoToGuests}
              className="flex items-center gap-1 text-[13px] font-semibold text-brand"
            >
              All guests <ArrowRight size={13} />
            </button>
          }
        />
        {needsAttention.length === 0 ? (
          <div className="mt-2 flex items-center gap-2 rounded-tap bg-success-soft px-3 py-3 text-[13px] text-success">
            <Check size={15} />
            Nothing outstanding.
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {needsAttention.map((row) => (
              <li key={row.guestId} className="flex items-center gap-3 py-2.5">
                <AppAvatar name={row.guestName} size="sm" />
                <button
                  type="button"
                  onClick={() => onOpenRow(row)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-[13px] font-semibold text-ink">
                    {row.guestName}
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {row.amountPaid > 0
                      ? `${formatTZS(row.amountPaid, currency)} of ${formatTZS(row.amountExpected ?? 0, currency)}`
                      : row.amountExpected
                        ? `owes ${formatTZS(row.amountExpected, currency)}`
                        : 'no amount set'}
                  </span>
                </button>
                <QuickComplete
                  row={row}
                  currency={currency}
                  busy={savingId === row.guestId}
                  onComplete={() => onSetStatus(row, 'PAID')}
                />
              </li>
            ))}
          </ul>
        )}
      </AppCard>
    </>
  );
}

function QuickComplete({
  row,
  currency,
  busy,
  onComplete,
}: {
  row: ManagerRow;
  currency: string;
  busy: boolean;
  onComplete: () => void;
}) {
  if (row.status === 'PAID') return null;
  return (
    <AppButton
      size="sm"
      variant="secondary"
      loading={busy}
      onClick={onComplete}
      className="shrink-0"
      aria-label={`Mark ${row.guestName} completed`}
    >
      {row.amountExpected ? formatTZS(row.amountExpected, currency) : 'Mark done'}
    </AppButton>
  );
}

// ─── Guests ───────────────────────────────────────────────────────────────

interface GuestsProps {
  rows: ManagerRow[];
  summary: ManagerSummary;
  filter: StatusFilter;
  query: string;
  savingId: string | null;
  enabled: boolean;
  onFilter: (f: StatusFilter) => void;
  onQuery: (q: string) => void;
  onOpenRow: (row: ManagerRow) => void;
  onSetStatus: (row: ManagerRow, status: ContributionStatus) => void;
}

function GuestsScreen({
  rows,
  summary,
  filter,
  query,
  savingId,
  enabled,
  onFilter,
  onQuery,
  onOpenRow,
  onSetStatus,
}: GuestsProps) {
  return (
    <>
      <AppCard padded={false}>
        <div className="space-y-3 border-b border-line p-4">
          <AppSegmentedControl
            label="Filter contributions by status"
            value={filter}
            onChange={(v) => onFilter(v as StatusFilter)}
            options={[
              { value: 'ALL', label: `All ${summary.total}` },
              { value: 'PENDING', label: `Not started ${summary.pending}` },
              { value: 'PARTIAL', label: `Partial ${summary.partial}` },
              { value: 'PAID', label: `Done ${summary.paid}` },
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
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search name or number"
              aria-label="Search guests"
              className="pl-9"
            />
            {query ? (
              <button
                type="button"
                onClick={() => onQuery('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-2"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>
        </div>

        {rows.length === 0 ? (
          <AppEmptyState
            icon={<Users size={20} />}
            size="sm"
            title={summary.total === 0 ? 'No guests on this event yet' : 'No guests match'}
            description={
              summary.total === 0
                ? 'Add guests to the event and they will appear here ready to track.'
                : 'Try a different name, number, or status filter.'
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <GuestRow
                key={row.guestId}
                row={row}
                currency={summary.currency || 'TZS'}
                busy={savingId === row.guestId}
                enabled={enabled}
                onOpen={() => onOpenRow(row)}
                onSetStatus={(status) => onSetStatus(row, status)}
              />
            ))}
          </ul>
        )}
      </AppCard>
    </>
  );
}

function GuestRow({
  row,
  currency,
  busy,
  enabled,
  onOpen,
  onSetStatus,
}: {
  row: ManagerRow;
  currency: string;
  busy: boolean;
  enabled: boolean;
  onOpen: () => void;
  onSetStatus: (status: ContributionStatus) => void;
}) {
  const transition = useTransition();
  const [tapped, setTapped] = useState<ContributionStatus | null>(null);
  const meta = CONTRIBUTION_STATUS_META[row.status];

  const press = (status: ContributionStatus) => {
    setTapped(status);
    // Cleared on the next frame-ish tick so the pulse reads as feedback on the
    // button rather than as a stuck loading state if the request is slow.
    window.setTimeout(() => setTapped(null), 320);
    onSetStatus(status);
  };

  return (
    <li className="px-4 py-3">
      <div className="flex items-start gap-3">
        <AppAvatar name={row.guestName} size="md" />
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold text-ink">{row.guestName}</span>
            <AppChip tone={row.status === 'PAID' ? 'success' : row.status === 'PARTIAL' ? 'warn' : 'neutral'}>
              {meta.label}
            </AppChip>
          </span>
          <span className="mt-0.5 block truncate text-[12px] text-muted">
            {row.phone ?? 'No number'}
            {row.remindedCount > 0 ? ` · reminded ${row.remindedCount}x` : ' · not reminded'}
          </span>
          {row.amountPaid > 0 || row.amountExpected ? (
            <span className="mt-1 block text-[12px] text-ink tabular-nums">
              {formatTZS(row.amountPaid, currency)}
              {row.amountExpected ? ` of ${formatTZS(row.amountExpected, currency)}` : ''}
            </span>
          ) : null}
          {!row.hasContribution ? (
            <span className="mt-1 inline-flex">
              <AppChip tone="outline">Not tracked yet</AppChip>
            </span>
          ) : null}
        </button>
      </div>

      <div className="mt-2.5 grid grid-cols-3 gap-1.5">
        {(['PENDING', 'PARTIAL', 'PAID'] as ContributionStatus[]).map((status) => {
          const on = row.status === status;
          const spinning = busy && on;
          return (
            <motion.button
              key={status}
              type="button"
              whileTap={{ scale: 0.96 }}
              transition={transition}
              disabled={!enabled || busy}
              aria-pressed={on}
              aria-label={`Mark ${row.guestName} as ${CONTRIBUTION_STATUS_META[status].label}`}
              onClick={() => press(status)}
              className={`relative flex h-9 items-center justify-center gap-1 overflow-hidden rounded-tap text-[12px] font-semibold transition-colors disabled:opacity-50 ${
                on ? 'text-white' : 'bg-surface-2 text-muted hover:text-ink'
              }`}
            >
              {on ? (
                <motion.span
                  layoutId={`row-bg-${row.guestId}`}
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
    </li>
  );
}

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

// ─── Guest editor sheet ────────────────────────────────────────────────────

function GuestEditorSheet({
  row,
  currency,
  saving,
  onClose,
  onSave,
}: {
  row: ManagerRow | null;
  currency: string;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Record<string, unknown>) => void | Promise<void>;
}) {
  const [amount, setAmount] = useState('');
  const [expected, setExpected] = useState('');
  const [note, setNote] = useState('');

  // Re-seed during render rather than in an effect: the sheet is keyed by
  // guestId, and deriving here means opening a row never flashes the previous
  // guest's numbers before the effect catches up.
  const [seededId, setSeededId] = useState<string | null>(null);
  if (row && seededId !== row.guestId) {
    setSeededId(row.guestId);
    setAmount(row.amountPaid ? String(row.amountPaid) : '');
    setExpected(row.amountExpected ? String(row.amountExpected) : '');
    setNote(row.note ?? '');
  }

  const paid = Number(amount.replace(/[^\d]/g, '')) || 0;
  const want = Number(expected.replace(/[^\d]/g, '')) || null;
  const dirty =
    amount !== (row?.amountPaid ? String(row.amountPaid) : '') ||
    expected !== (row?.amountExpected ? String(row.amountExpected) : '') ||
    note !== (row?.note ?? '');

  return (
    <AppBottomSheet
      open={!!row}
      onClose={onClose}
      title={row?.guestName}
      description={
        row
          ? `${row.phone ?? 'No number'}${
              row.updatedByName ? ` · last updated by ${row.updatedByName}` : ''
            }`
          : undefined
      }
      footer={
        row ? (
          <div className="flex gap-2">
            <AppButton variant="ghost" onClick={onClose} fullWidth>
              Cancel
            </AppButton>
            <AppButton
              onClick={() =>
                void onSave({ amountPaid: paid, amountExpected: want, note: note.trim() || null })
              }
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
            label={`Amount received (${currency})`}
            hint="Set 0 if nothing has arrived yet."
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
          />

          <AppInput
            label={`Amount expected (${currency})`}
            hint="Optional. Reaching this marks the guest completed automatically."
            inputMode="numeric"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            placeholder="e.g. 500000"
          />

          <div className="flex flex-wrap gap-2">
            <QuickAmountButton
              label={`+${formatTZS(QUICK_ADD, currency)}`}
              onClick={() => setAmount(String(paid + QUICK_ADD))}
            />
            {want ? (
              <QuickAmountButton
                label={`Full ${formatTZS(want, currency)}`}
                onClick={() => setAmount(String(want))}
              />
            ) : null}
            {paid > 0 ? (
              <QuickAmountButton label="Clear" onClick={() => setAmount('')} />
            ) : null}
          </div>

          <AppInput
            label="Note"
            hint="Optional. Visible to the tenant only."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            placeholder="e.g. Paid via bank, confirmed 12 Nov"
          />

          {want && paid >= want ? (
            <p className="flex items-center gap-2 rounded-tap bg-success-soft px-3 py-2.5 text-[13px] text-success">
              <Check size={14} />
              This will be marked completed automatically.
            </p>
          ) : null}

          {row.phone ? (
            <a
              href={`tel:${row.phone}`}
              className="flex items-center justify-center gap-2 rounded-tap border border-line bg-surface py-2.5 text-[13px] font-semibold text-ink"
            >
              <Phone size={14} />
              Call {row.guestName.split(' ')[0]}
            </a>
          ) : null}
        </div>
      ) : null}
    </AppBottomSheet>
  );
}

function QuickAmountButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-tap bg-surface-2 px-3 py-2 text-[12px] font-semibold text-ink"
    >
      {label}
    </button>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────

function SettingsScreen({
  form,
  saving,
  onChange,
  onSave,
  onCancel,
}: {
  form: SettingsForm | null;
  saving: boolean;
  onChange: (f: SettingsForm) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!form) {
    return (
      <div className="grid place-items-center py-10">
        <Loader2 className="size-6 animate-spin text-brand" />
      </div>
    );
  }

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <>
      <AppCard>
        <AppCardTitle title="Tracking" subtitle="Controls what the shared tracker can do." />
        <div className="mt-3 space-y-3">
          <Toggle
            label="Enable tracking"
            description="Publishes the shared page and stops reminders going to guests who have paid in full."
            checked={form.contributionsEnabled}
            onChange={(v) => set('contributionsEnabled', v)}
          />
        </div>
      </AppCard>

      <AppCard>
        <AppCardTitle
          title="Template details"
          subtitle="These fill the approved Mchango WhatsApp template."
        />
        <div className="mt-3 space-y-3.5">
          <AppSelect
            label="Occasion"
            hint="Template var1"
            value={form.eventType}
            onChange={(e) => set('eventType', e.target.value)}
          >
            <option value="">Not set</option>
            {MCHANGO_OCCASIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </AppSelect>

          <AppInput
            type="date"
            label="Payment deadline"
            hint="Template var9"
            value={form.contributionDeadline}
            onChange={(e) => set('contributionDeadline', e.target.value)}
          />

          <AppInput
            inputMode="numeric"
            label="Target amount"
            hint="Optional. Drives the progress ring and the outstanding figure."
            value={form.contributionTarget}
            onChange={(e) => set('contributionTarget', e.target.value)}
            placeholder="e.g. 5000000"
          />

          <div className="grid gap-3.5 sm:grid-cols-2">
            <AppInput
              label="M-Pesa"
              hint="Template var10"
              value={form.mpesaInstructions}
              onChange={(e) => set('mpesaInstructions', e.target.value)}
              placeholder="Name, number, what to write"
            />
            <AppInput
              label="Airtel Money"
              hint="Template var11"
              value={form.airtelInstructions}
              onChange={(e) => set('airtelInstructions', e.target.value)}
              placeholder="Name, number, what to write"
            />
          </div>

          <AppInput
            label="Bank"
            hint="Template var12"
            value={form.bankInstructions}
            onChange={(e) => set('bankInstructions', e.target.value)}
            placeholder="Bank, account name, number"
          />

          <p className="flex items-start gap-2 rounded-tap bg-brand-soft px-3 py-2.5 text-[12px] leading-relaxed text-brand">
            <SlidersHorizontal size={14} className="mt-0.5 shrink-0" />
            <span>
              Greetings, names, venue, address and the contact number come from the event itself.
              Edit those from the reminder screen, where you can preview the finished message.
            </span>
          </p>
        </div>

        <div className="mt-4 flex gap-2">
          <AppButton variant="ghost" onClick={onCancel} fullWidth>
            Cancel
          </AppButton>
          <AppButton onClick={onSave} loading={saving} loadingText="Saving" fullWidth>
            Save settings
          </AppButton>
        </div>
      </AppCard>
    </>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const transition = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center gap-3 rounded-card border p-3 text-left transition-colors ${
        checked ? 'border-brand/30 bg-brand-soft' : 'border-line bg-surface-2'
      }`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">{description}</span>
      </span>
      <span
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-brand' : 'bg-line'
        }`}
      >
        <motion.span
          layout
          transition={transition}
          className="absolute top-0.5 size-5 rounded-full bg-white shadow-elev-1"
          style={{ left: checked ? 18 : 2 }}
        />
      </span>
    </button>
  );
}
