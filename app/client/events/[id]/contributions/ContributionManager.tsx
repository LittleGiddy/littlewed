// app/client/events/[id]/contributions/ContributionManager.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Settings2,
  Users,
  Wallet,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import {
  AppBottomSheet,
  AppButton,
  AppField,
  AppInput,
  AppPageHeader,
  AppSegmentedControl,
  AppSpinner,
  ShareLinkButton,
  CONTRIBUTION_STATUSES,
  formatTZS,
  type ContributionStatus,
} from '@/components/ui';

interface ManagerEvent {
  id: string;
  name: string;
  date: string;
  venue: string;
  address: string;
  person1: string | null;
  person2: string | null;
  hostFamily: string | null;
  contributionsEnabled: boolean;
  eventType: string | null;
  contributionDeadline: string | null;
  contributionTarget: number | null;
  contributionCurrency: string | null;
  mpesaInstructions: string | null;
  airtelInstructions: string | null;
  bankInstructions: string | null;
}

interface ManagerRow {
  id: string;
  guestId: string;
  guestName: string;
  phone: string | null;
  status: ContributionStatus;
  amountPaid: number;
  amountExpected: number | null;
  note: string | null;
  updatedByName: string | null;
  remindedAt: string | null;
  remindedCount: number;
  updatedAt: string;
}

interface ManagerSummary {
  total: number;
  pending: number;
  partial: number;
  paid: number;
  outstanding: number;
  collected: number;
  target: number | null;
  currency: string;
}

const STATUS_META: Record<
  ContributionStatus,
  { label: string; chip: string; dot: string }
> = {
  PENDING: { label: 'Not started', chip: 'bg-surface-2 text-muted ring-line', dot: 'bg-muted' },
  PARTIAL: { label: 'Partial', chip: 'bg-warn-soft text-warn ring-warn-border', dot: 'bg-warn' },
  PAID: { label: 'Completed', chip: 'bg-success-soft text-success ring-success-border', dot: 'bg-success' },
};

const EVENT_TYPES = ['Send-Off', 'Wedding', 'Introduction', 'Baby Shower', 'Graduation', 'Other'];

export default function ContributionManager({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [data, setData] = useState<{
    event: ManagerEvent;
    summary: ManagerSummary;
    rows: ManagerRow[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | ContributionStatus>('ALL');
  const [query, setQuery] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const [form, setForm] = useState({
    contributionsEnabled: false,
    eventType: 'Send-Off',
    contributionDeadline: '',
    contributionTarget: '',
    contributionCurrency: 'TZS',
    mpesaInstructions: '',
    airtelInstructions: '',
    bankInstructions: '',
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${eventId}/contributions`, {
        credentials: 'include',
      });
      if (res.status === 401) {
        router.push('/login');
        return;
      }
      if (!res.ok) throw new Error('Could not load contributions');
      const payload = await res.json();
      setData(payload);
      setForm({
        contributionsEnabled: Boolean(payload.event.contributionsEnabled),
        eventType: payload.event.eventType || 'Send-Off',
        contributionDeadline: payload.event.contributionDeadline
          ? new Date(payload.event.contributionDeadline).toISOString().slice(0, 10)
          : '',
        contributionTarget: payload.event.contributionTarget
          ? String(payload.event.contributionTarget)
          : '',
        contributionCurrency: payload.event.contributionCurrency || 'TZS',
        mpesaInstructions: payload.event.mpesaInstructions || '',
        airtelInstructions: payload.event.airtelInstructions || '',
        bankInstructions: payload.event.bankInstructions || '',
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [eventId, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSettings = useCallback(async () => {
    setSavingSettings(true);
    try {
      const res = await fetch(`/api/events/${eventId}/contributions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          settings: {
            ...form,
            contributionDeadline: form.contributionDeadline || null,
            contributionTarget: form.contributionTarget || null,
          },
        }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error || 'Could not save');
      }
      const payload = await res.json();
      setData(payload);
      setSettingsOpen(false);
      toast.success('Contribution settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSavingSettings(false);
    }
  }, [eventId, form]);

  const updateRow = useCallback(
    async (row: ManagerRow, patch: { status?: ContributionStatus; amountPaid?: number; note?: string }) => {
      setSavingId(row.id);
      try {
        const res = await fetch(`/api/events/${eventId}/contributions`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ guestId: row.guestId, ...patch }),
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload?.error || 'Could not save');
        setData((cur) => (cur ? { ...cur, summary: payload.summary, rows: payload.rows } : cur));
        toast.success('Updated');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save');
      } finally {
        setSavingId(null);
      }
    },
    [eventId]
  );

  const trackerUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/${eventId}/contributions`;
  }, [eventId]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!data) return [];
    return data.rows.filter((r) => {
      if (filter !== 'ALL' && r.status !== filter) return false;
      if (!q) return true;
      return r.guestName.toLowerCase().includes(q) || (r.phone || '').includes(q);
    });
  }, [data, filter, query]);

  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas">
        <AppSpinner label="Loading contributions" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas px-6 text-center">
        <div>
          <p className="text-sm text-muted">{error ?? 'Not found'}</p>
          <AppButton variant="secondary" className="mt-4" onClick={() => router.push('/client/events')}>
            Back to events
          </AppButton>
        </div>
      </div>
    );
  }

  const { event, summary } = data;
  const currency = event.contributionCurrency || 'TZS';
  const progressPct =
    summary.target && summary.target > 0
      ? Math.min(100, Math.round((summary.collected / summary.target) * 100))
      : null;

  return (
    <div className="min-h-dvh bg-canvas pb-[calc(4rem+var(--app-nav-safe))]">
      <div className="pt-4">
        <Link
          href={`/client/events/${eventId}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to event
        </Link>
      </div>

      <AppPageHeader
        eyebrow="Contributions"
        title={event.name}
        description="Share the tracker with your client, and keep every status in one place."
        actions={
          <AppButton variant="secondary" size="sm" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="size-4" aria-hidden="true" />
            Settings
          </AppButton>
        }
      />

      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 pb-10 sm:px-6">
        {!event.contributionsEnabled ? (
          <div className="rounded-card border border-warn-border bg-warn-soft p-4 text-sm">
            <p className="font-semibold text-warn">Tracking is switched off</p>
            <p className="mt-1 text-warn/90">
              The shared page stays hidden and reminders will not skip paid guests until you turn
              it on.
            </p>
            <AppButton variant="primary" size="sm" className="mt-3" onClick={() => setSettingsOpen(true)}>
              Turn on tracking
            </AppButton>
          </div>
        ) : null}

        {/* Share */}
        <section className="rounded-card bg-surface p-5 shadow-card">
          <h2 className="font-display text-lg">Share the tracker</h2>
          <p className="mt-1.5 text-sm text-muted">
            Send this to your client so they can mark who has paid. Anyone with the link can
            change a status, and every change is recorded.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <code className="min-w-0 flex-1 truncate rounded-tap bg-surface-2 px-3.5 py-3 text-xs text-muted">
              {trackerUrl}
            </code>
            <div className="flex shrink-0 gap-2">
              <ShareLinkButton
                url={trackerUrl}
                title={`${event.name} contributions`}
                text="Track who has completed their contribution."
                label="Share"
                variant="primary"
                className="flex-1 sm:flex-none"
              />
              {event.contributionsEnabled ? (
                <a
                  href={trackerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid size-11 place-items-center rounded-tap bg-surface-2 text-muted ring-1 ring-inset ring-line transition-colors hover:text-ink"
                  aria-label="Open tracker"
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {/* Summary */}
        <section className="rounded-card bg-surface p-5 shadow-card">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted">
                Collected
              </p>
              <p className="mt-1 font-display text-2xl leading-none">
                {formatTZS(summary.collected, currency)}
              </p>
            </div>
            <AppButton variant="ghost" size="sm" onClick={() => void load()} aria-label="Refresh">
              <RefreshCw className="size-4" aria-hidden="true" />
            </AppButton>
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
                {progressPct}% of {formatTZS(summary.target, currency)} ·{' '}
                {formatTZS(summary.outstanding, currency)} outstanding
              </p>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {(
              [
                { label: 'Not started', value: summary.pending },
                { label: 'Partial', value: summary.partial },
                { label: 'Completed', value: summary.paid },
              ]
            ).map((s) => (
              <div key={s.label} className="rounded-tap bg-surface-2 px-2 py-3">
                <p className="font-display text-xl leading-none">{s.value}</p>
                <p className="mt-1 text-[0.68rem] uppercase tracking-wide text-muted">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* List */}
        <section className="rounded-card bg-surface shadow-card">
          <div className="space-y-4 border-b border-line p-5">
            <h2 className="flex items-center gap-2 font-display text-lg">
              <Users className="size-4 text-brand" aria-hidden="true" />
              {summary.total} guest{summary.total === 1 ? '' : 's'} reminded
            </h2>

            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <AppInput
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or number"
                aria-label="Search guests"
                className="pl-10"
              />
            </div>

            <AppSegmentedControl
              label="Filter contributions by status"
              value={filter}
              onChange={(v) => setFilter(v as 'ALL' | ContributionStatus)}
              options={[
                { value: 'ALL', label: `All ${summary.total}` },
                { value: 'PENDING', label: `Pending ${summary.pending}` },
                { value: 'PARTIAL', label: `Partial ${summary.partial}` },
                { value: 'PAID', label: `Done ${summary.paid}` },
              ]}
            />
          </div>

          {visibleRows.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <Wallet className="mx-auto size-8 text-muted" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-ink">
                {summary.total === 0 ? 'No guests reminded yet' : 'No guests match'}
              </p>
              <p className="mx-auto mt-1 max-w-xs text-xs text-muted">
                {summary.total === 0
                  ? 'Contribution rows are created automatically the first time you send a reminder.'
                  : 'Try a different filter or search term.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {visibleRows.map((row) => {
                const meta = STATUS_META[row.status];
                const saving = savingId === row.id;
                return (
                  <li key={row.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{row.guestName}</p>
                        <p className="mt-0.5 text-xs tabular-nums text-muted">
                          {row.phone || 'No number'}
                          {row.remindedCount > 0 ? ` · reminded ${row.remindedCount}×` : ''}
                        </p>
                      </div>
                      <span
                        className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ring-1 ring-inset ${meta.chip}`}
                      >
                        <span className={`size-1.5 rounded-full ${meta.dot}`} aria-hidden="true" />
                        {meta.label}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {CONTRIBUTION_STATUSES.map((status) => {
                        const active = row.status === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            disabled={saving || active}
                            onClick={() => void updateRow(row, { status })}
                            aria-pressed={active}
                            className={`min-h-11 rounded-tap px-2 py-2 text-xs font-semibold transition-colors disabled:opacity-70 ${
                              active
                                ? 'bg-brand text-white'
                                : 'bg-surface-2 text-muted ring-1 ring-inset ring-line hover:text-ink'
                            }`}
                          >
                            {saving && active ? (
                              <Loader2 className="mx-auto size-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              STATUS_META[status].label
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void updateRow(row, {
                            amountPaid: row.amountExpected
                              ? row.amountExpected
                              : row.amountPaid + (row.amountExpected ? 0 : 50000),
                          })
                        }
                        disabled={saving}
                        className="min-h-9 rounded-tap bg-surface-2 px-3 text-xs font-semibold text-ink ring-1 ring-inset ring-line transition-colors hover:bg-brand-50 disabled:opacity-60"
                      >
                        {row.amountExpected ? 'Mark full amount' : 'Add 50,000'}
                      </button>
                      {row.amountPaid > 0 ? (
                        <span className="text-xs text-muted">
                          received {formatTZS(row.amountPaid, currency)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="flex justify-center">
          <Link
            href={`/client/events/${eventId}/remind`}
            className="inline-flex min-h-11 items-center gap-2 rounded-tap bg-brand px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Banknote className="size-4" aria-hidden="true" />
            Send contribution reminders
          </Link>
        </div>
      </main>

      {/* Settings sheet */}
      <AppBottomSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Contribution settings"
        description="These fill the approved Mchango WhatsApp template."
      >
        <div className="space-y-4">
          <label className="flex items-start gap-3 rounded-tap bg-surface-2 p-4">
            <input
              type="checkbox"
              checked={form.contributionsEnabled}
              onChange={(e) => setForm((f) => ({ ...f, contributionsEnabled: e.target.checked }))}
              className="mt-0.5 size-5 shrink-0 accent-[var(--color-brand)]"
            />
            <span>
              <span className="block text-sm font-semibold text-ink">Enable tracking</span>
              <span className="mt-0.5 block text-xs text-muted">
                Publishes the shared page and stops reminders going to guests who have paid in full.
              </span>
            </span>
          </label>

          <AppField label="Occasion" hint="Template var1">
            {({ id }) => (
              <select
                id={id}
                value={form.eventType}
                onChange={(e) => setForm((f) => ({ ...f, eventType: e.target.value }))}
                className="h-11 w-full rounded-tap border border-line bg-surface px-3.5 text-sm outline-none focus:border-brand-300"
              >
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </AppField>

          <AppField label="Payment deadline" hint="Template var9">
            {({ id }) => (
              <AppInput
                id={id}
                type="date"
                value={form.contributionDeadline}
                onChange={(e) => setForm((f) => ({ ...f, contributionDeadline: e.target.value }))}
              />
            )}
          </AppField>

          <AppField label="Target amount" hint="Optional, drives the progress bar">
            {({ id }) => (
              <AppInput
                id={id}
                type="text"
                inputMode="numeric"
                value={form.contributionTarget}
                onChange={(e) => setForm((f) => ({ ...f, contributionTarget: e.target.value }))}
                placeholder="e.g. 5000000"
              />
            )}
          </AppField>

          <AppField label="M-Pesa" hint="Template var10">
            {({ id }) => (
              <AppInput
                id={id}
                value={form.mpesaInstructions}
                onChange={(e) => setForm((f) => ({ ...f, mpesaInstructions: e.target.value }))}
                placeholder="M-Pesa: 0762208760 - MAGRETH MKUMBI"
              />
            )}
          </AppField>

          <AppField label="Airtel Money" hint="Template var11">
            {({ id }) => (
              <AppInput
                id={id}
                value={form.airtelInstructions}
                onChange={(e) => setForm((f) => ({ ...f, airtelInstructions: e.target.value }))}
                placeholder="Airtel Money: 0788161381 - MAGRETH MKUMBI"
              />
            )}
          </AppField>

          <AppField label="Bank" hint="Template var12">
            {({ id }) => (
              <AppInput
                id={id}
                value={form.bankInstructions}
                onChange={(e) => setForm((f) => ({ ...f, bankInstructions: e.target.value }))}
                placeholder="CRDB BANK: 0152546773500 - MAGRETH MK"
              />
            )}
          </AppField>

          <p className="rounded-tap bg-brand-50 p-3.5 text-xs leading-relaxed text-brand-700">
            var2 and var3 come from the event names (host family / person1 &amp; person2), var4 the
            venue, var5 the event name, var6 the second name, var7 the event date and var8 the
            address. var13 uses the contact number on this event, falling back to your business
            name.
          </p>

          <div className="flex gap-2 pt-1">
            <AppButton
              variant="secondary"
              className="flex-1"
              onClick={() => setSettingsOpen(false)}
              disabled={savingSettings}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Cancel
            </AppButton>
            <AppButton
              variant="primary"
              className="flex-1"
              onClick={() => void saveSettings()}
              disabled={savingSettings}
            >
              {savingSettings ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Check className="size-4" aria-hidden="true" />
              )}
              Save
            </AppButton>
          </div>
        </div>
      </AppBottomSheet>
    </div>
  );
}
