// app/client/events/[id]/contributions/shell.tsx
// Shared visual shell for the contribution ledger. The tenant manager and the
// public tracker render the same hero, summary and guest list so the two views
// cannot drift apart. Only the sheets and the tenant-only settings differ.
'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpDown,
  CalendarClock,
  Check,
  ChevronRight,
  MapPin,
  PartyPopper,
  Phone,
  RefreshCw,
  Search,
  Users,
  X,
} from 'lucide-react';
import {
  AppAvatar,
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
import { phoneMatches } from '@/lib/phone';
import { ProgressRing, StatTiles, buildTiles } from './widgets';

export interface LedgerRow {
  /** Empty for a guest who has no Contribution row yet. */
  id: string;
  guestId: string;
  guestName: string;
  /** The guest's own name without the title. */
  name: string;
  phone: string | null;
  status: ContributionStatus;
  amountPaid: number;
  amountExpected: number | null;
  note: string | null;
  updatedAt: string | null;
  pendingEdit?: { name: string; phone: string | null } | null;
  remindedCount?: number;
  hasContribution?: boolean;
}

export interface LedgerSummary {
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

export const QUICK_ADD = 50_000;

export const STATUS_TONE: Record<ContributionStatus, 'success' | 'warn' | 'neutral'> = {
  PAID: 'success',
  PARTIAL: 'warn',
  PENDING: 'neutral',
};

const CHEVRON =
  "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280' stroke-width='2'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' d='m19.5 8.25-7.5 7.5-7.5-7.5'/%3e%3c/svg%3e\")";

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function remainingOf(row: LedgerRow) {
  return row.amountExpected && row.amountExpected > row.amountPaid
    ? row.amountExpected - row.amountPaid
    : 0;
}

function reducedInitial(transition: { duration: number }) {
  return transition.duration === 0 ? { opacity: 0 } : { opacity: 0, y: 10 };
}

/** Brand hero shared by the tenant manager and the public tracker. */
export function ContributionHero({
  name,
  eventType,
  date,
  venue,
  actions,
}: {
  name: string;
  eventType?: string | null;
  date: string;
  venue?: string | null;
  actions?: ReactNode;
}) {
  const transition = useTransition();
  const reduced = useReducedMotion();

  const details = [
    { icon: CalendarClock, label: 'Event date', value: date },
    { icon: MapPin, label: 'Venue', value: venue || 'Not set' },
  ];

  return (
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
        {actions ? (
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2 sm:right-6 sm:top-6">
            {actions}
          </div>
        ) : null}
        <motion.div
          initial={reducedInitial(transition)}
          animate={{ opacity: 1, y: 0 }}
          transition={transition}
        >
          <p className="flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-200">
            <PartyPopper className="size-3.5 shrink-0" aria-hidden="true" />
            Contributions
          </p>
          <h1 className="mt-2.5 break-words font-display text-[27px] leading-[1.15] sm:text-4xl">
            {name}
          </h1>
          {eventType ? (
            <p className="mt-1.5 break-words text-sm text-brand-100">{eventType}</p>
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
              <dd className="mt-1 break-words text-sm font-semibold leading-snug">
                {item.value}
              </dd>
            </motion.div>
          ))}
        </motion.dl>
      </div>
    </header>
  );
}

/** Small icon button that sits legibly on the brand hero. */
export function HeroIconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="grid size-9 place-items-center rounded-full bg-white/10 text-white ring-1 ring-inset ring-white/20 backdrop-blur transition hover:bg-white/20 active:bg-white/30 disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Headline progress card shared by both ledger views. */
export function ContributionSummaryCard({
  summary,
  currency,
  progressPct,
}: {
  summary: LedgerSummary;
  currency: string;
  progressPct: number | null;
}) {
  return (
    <AppCard>
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-6">
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
            <p className="mt-3 text-center text-[12px] leading-relaxed text-muted sm:text-left">
              <span className="font-semibold text-ink">{progressPct}%</span> of the target
              collected
              {summary.outstanding > 0
                ? ` · ${formatTZS(summary.outstanding, currency)} still outstanding`
                : ' · nothing outstanding'}
            </p>
          ) : null}
        </div>
      </div>
    </AppCard>
  );
}

/**
 * Search, filter, sort and the guest list itself. The tenant and public views
 * differ only in the row extras they ask for (`showReminded` / `showTracked`).
 */
export function LedgerCard<T extends LedgerRow>({
  rows,
  summary,
  currency,
  onOpenRow,
  onRefresh,
  refreshing,
  busyGuestId,
  showReminded = false,
  showTracked = false,
  title = 'Guest contributions',
  subtitle = 'Tap a guest to see their full details and record what you received.',
  emptyTitle,
  emptyDescription,
}: {
  rows: T[];
  summary: LedgerSummary;
  currency: string;
  onOpenRow: (row: T) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  busyGuestId?: string | null;
  showReminded?: boolean;
  showTracked?: boolean;
  title?: string;
  subtitle?: string;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const [filter, setFilter] = useState<Filter>('ALL');
  const [sort, setSort] = useState<SortKey>('NAME');
  const [recordedOnly, setRecordedOnly] = useState(false);
  const [notedOnly, setNotedOnly] = useState(false);
  const [query, setQuery] = useState('');
  const reduced = useReducedMotion();

  const counts = useMemo(
    () => ({
      ALL: rows.length,
      PENDING: summary.pending,
      PARTIAL: summary.partial,
      PAID: summary.paid,
    }),
    [rows.length, summary]
  );

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = rows.filter((r) => {
      if (filter !== 'ALL' && r.status !== filter) return false;
      if (recordedOnly && !r.id) return false;
      if (notedOnly && !r.note) return false;
      if (!q) return true;
      const byName = r.guestName.toLowerCase().includes(q);
      const byPhone = phoneMatches(r.phone, query);
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
  }, [rows, filter, query, recordedOnly, notedOnly, sort]);

  const filtersActive =
    filter !== 'ALL' || sort !== 'NAME' || recordedOnly || notedOnly || query.trim() !== '';

  const clearFilters = () => {
    setFilter('ALL');
    setSort('NAME');
    setRecordedOnly(false);
    setNotedOnly(false);
    setQuery('');
  };

  return (
    <AppCard padded={false}>
      <div className="space-y-3 border-b border-line p-4">
        <div className="flex items-start justify-between gap-3">
          <AppCardTitle title={title} subtitle={subtitle} />
          {onRefresh ? (
            <button
              type="button"
              onClick={onRefresh}
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
          ) : null}
        </div>

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
              style={{
                backgroundImage: CHEVRON,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.65rem center',
                backgroundSize: '14px',
              }}
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
          {summary.total} guest{summary.total === 1 ? '' : 's'}
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
            emptyTitle ??
            (rows.length === 0 ? 'No guests on this event yet' : 'No guests match')
          }
          description={
            emptyDescription ??
            (rows.length === 0
              ? 'Once guests are added to the event they will appear here.'
              : 'Try a different name, phone number, or filter.')
          }
          action={
            filtersActive && rows.length > 0 ? (
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
                <LedgerGuestRow
                  row={row}
                  currency={currency}
                  busy={busyGuestId === row.guestId}
                  showReminded={showReminded}
                  showTracked={showTracked}
                  onOpen={() => onOpenRow(row)}
                />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </AppCard>
  );
}

function LedgerGuestRow({
  row,
  currency,
  busy,
  showReminded,
  showTracked,
  onOpen,
}: {
  row: LedgerRow;
  currency: string;
  busy: boolean;
  showReminded: boolean;
  showTracked: boolean;
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
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="min-w-0 break-words text-[14px] font-semibold leading-snug text-ink">
                {row.guestName}
              </span>
              <AppChip tone={STATUS_TONE[row.status]}>{meta.label}</AppChip>
              {row.pendingEdit ? <AppChip tone="warn">Awaiting approval</AppChip> : null}
            </span>

            {row.phone ? (
              <span className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
                <Phone size={12} className="shrink-0" aria-hidden="true" />
                <span className="break-all tabular-nums">{row.phone}</span>
              </span>
            ) : (
              <span className="mt-1 block text-[13px] text-muted">No phone number</span>
            )}
          </span>

          <span className="shrink-0 text-right">
            {row.amountPaid > 0 || row.amountExpected ? (
              <>
                <span className="block text-[14px] font-bold tabular-nums text-ink">
                  {formatTZS(row.amountPaid, currency)}
                </span>
                {row.amountExpected ? (
                  <span className="block text-[11px] tabular-nums text-muted">
                    of {formatTZS(row.amountExpected, currency)}
                  </span>
                ) : null}
                {remaining > 0 ? (
                  <span className="block text-[11px] font-semibold tabular-nums text-warn">
                    {formatTZS(remaining, currency)} left
                  </span>
                ) : null}
              </>
            ) : (
              <span className="text-[13px] font-semibold text-muted">—</span>
            )}
          </span>
        </span>

        {row.note ? (
          <span className="mt-1 block break-words text-[12px] italic leading-snug text-muted">
            “{row.note}”
          </span>
        ) : null}

        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted">
          {row.updatedAt ? <span>Updated {formatDate(row.updatedAt)}</span> : null}
          {showReminded ? (
            <span>
              {row.remindedCount ? `reminded ${row.remindedCount}x` : 'not reminded'}
            </span>
          ) : null}
          {showTracked && row.hasContribution === false ? (
            <AppChip tone="outline">Not tracked yet</AppChip>
          ) : null}
        </span>
      </span>

      <ChevronRight size={16} className="mt-1.5 shrink-0 text-gray-300" aria-hidden="true" />
    </button>
  );
}

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

export function DetailTile({
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

export function QuickAmountButton({ label, onClick }: { label: string; onClick: () => void }) {
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
