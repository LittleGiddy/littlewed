// app/client/events/[id]/contributions/ContributionManager.tsx
// Tenant-facing contribution tracking.
//
// The layout is deliberately the same as the shared tracker: brand hero,
// headline progress card, then one searchable guest ledger. Settings and the
// per-guest editor live in bottom sheets so the main view stays identical to
// the link the tenant sends to their client.
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Phone,
  Settings2,
  SlidersHorizontal,
  Wallet,
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
  AppSegmentedControl,
  AppSelect,
  ShareLinkButton,
  formatTZS,
  CONTRIBUTION_STATUS_META,
  type ContributionStatus,
} from '@/components/ui';
import { MCHANGO_OCCASIONS, formatSwahiliDate } from '@/lib/whatsapp/mchango';
import { useTransition } from '@/lib/motion';
import {
  ContributionHero,
  ContributionSummaryCard,
  DetailTile,
  HeroIconButton,
  LedgerCard,
  QUICK_ADD,
  QuickAmountButton,
  STATUS_TONE,
  formatDate,
  remainingOf,
} from './shell';
import type {
  ManagerPayload,
  ManagerRow,
  ManagerSummary,
  SettingsForm,
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

function settingsFromPayload(data: ManagerPayload): SettingsForm {
  return {
    contributionsEnabled: data.event.contributionsEnabled,
    eventType: data.event.eventType ?? '',
    contributionTarget: data.event.contributionTarget
      ? String(data.event.contributionTarget)
      : '',
    contributionCurrency: data.event.contributionCurrency || 'TZS',
    mpesaInstructions: data.event.mpesaInstructions ?? '',
    airtelInstructions: data.event.airtelInstructions ?? '',
    bankInstructions: data.event.bankInstructions ?? '',
  };
}

export default function ContributionManager({ eventId }: { eventId: string }) {
  const router = useRouter();

  const [data, setData] = useState<ManagerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<ManagerRow | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [form, setForm] = useState<SettingsForm | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    setForm(settingsFromPayload(data));
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
        if (!res.ok) {
          // Validation failures (bad number, duplicate number) come back with a
          // message worth showing; falling back to the generic copy hides why.
          const problem = (await res.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(problem?.error || 'Could not save');
        }
        const payload: ManagerPayload = await res.json();
        setData(payload);
        return payload;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not save that change. Try again.');
        return null;
      } finally {
        setSavingId(null);
      }
    },
    [eventId]
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
      setSettingsOpen(false);
      toast.success('Settings saved.');
    } catch {
      toast.error('Could not save settings.');
    } finally {
      setSavingSettings(false);
    }
  }, [eventId, form]);

  const closeSettings = useCallback(() => {
    // Cancel means discard: the sheet is a form, not a persistent draft.
    if (data) setForm(settingsFromPayload(data));
    setSettingsOpen(false);
  }, [data]);

  // ─── Derived ────────────────────────────────────────────────────────────
  const progressPct =
    summary.target && summary.target > 0
      ? Math.min(100, Math.round((summary.collected / summary.target) * 100))
      : null;

  // The server echo replaces `rows`, so the open sheet reads the fresh copy
  // rather than the snapshot it was opened with.
  const editingLive = editing
    ? (data?.rows.find((r) => r.guestId === editing.guestId) ?? editing)
    : null;

  // ─── States ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="size-7 animate-spin text-brand" aria-label="Loading" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="grid min-h-[60vh] place-items-center px-6">
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
  const venue = event.venue || event.address || null;

  return (
    <div className="-mx-4 -mt-5 sm:-mx-6 sm:-mt-6 lg:-mx-8 lg:-mt-8">
      <ContributionHero
        name={event.name}
        eventType={event.eventType}
        date={formatSwahiliDate(event.date)}
        venue={venue}
        actions={
          <>
            {trackerUrl ? (
              <ShareLinkButton
                url={trackerUrl}
                title={`${event.name} contributions`}
                text="Track who has completed their contribution."
                label="Share"
                variant="ghost"
                size="sm"
                className="!bg-white/10 !text-white ring-1 ring-inset ring-white/20 hover:!bg-white/20"
              />
            ) : null}
            <HeroIconButton
              label="Contribution settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={16} aria-hidden="true" />
            </HeroIconButton>
          </>
        }
      />

      <main className="relative mx-auto -mt-8 w-full max-w-3xl space-y-4 px-4 pb-8 sm:px-6">
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
                setSettingsOpen(true);
              }}
            >
              Turn on tracking
            </AppButton>
          </AppCard>
        ) : null}

        <ContributionSummaryCard
          summary={summary}
          currency={currency}
          progressPct={progressPct}
        />

        <LedgerCard
          rows={data.rows}
          summary={summary}
          currency={currency}
          onOpenRow={setEditing}
          onRefresh={() => void refresh()}
          refreshing={refreshing}
          busyGuestId={savingId}
          showReminded
          showTracked
          subtitle="Tap a guest to edit their details, amounts, or status."
        />

        <AppCard tone="tinted">
          <div className="space-y-1.5 text-center">
            <p className="flex items-center justify-center gap-2 text-[13px] font-medium text-ink">
              <Check size={14} className="shrink-0 text-brand" aria-hidden="true" />
              Guests marked completed stop receiving reminders.
            </p>
            <p className="text-[11px] leading-relaxed text-muted">
              Tap any guest to record what arrived, set an expected amount, or correct their
              name and number.
            </p>
          </div>
        </AppCard>
      </main>

      <GuestEditorSheet
        row={editingLive}
        currency={currency}
        saving={savingId === editingLive?.guestId}
        onClose={() => setEditing(null)}
        onSave={async (patch) => {
          if (!editingLive) return;
          const payload = await patchRow(editingLive, patch);
          if (payload) {
            // Prefer the rebuilt row so a rename confirms under the new name.
            const updated = payload.rows.find((r) => r.guestId === editingLive.guestId);
            setEditing(null);
            toast.success(`${updated?.guestName ?? editingLive.guestName} updated`);
          }
        }}
      />

      <SettingsSheet
        open={settingsOpen}
        form={form}
        saving={savingSettings}
        trackerUrl={trackerUrl}
        onChange={setForm}
        onSave={saveSettings}
        onClose={closeSettings}
      />
    </div>
  );
}

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
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<ContributionStatus>('PENDING');

  // Re-seed during render rather than in an effect: the sheet is keyed by
  // guestId, and deriving here means opening a row never flashes the previous
  // guest's numbers before the effect catches up.
  const [seededId, setSeededId] = useState<string | null>(null);
  if (row && seededId !== row.guestId) {
    setSeededId(row.guestId);
    setAmount(row.amountPaid ? String(row.amountPaid) : '');
    setExpected(row.amountExpected ? String(row.amountExpected) : '');
    setNote(row.note ?? '');
    setName(row.name ?? '');
    setPhone(row.phone ?? '');
    setStatus(row.status);
  }

  const paid = Number(amount.replace(/[^\d]/g, '')) || 0;
  const want = Number(expected.replace(/[^\d]/g, '')) || null;
  const guestDirty = !!row && (name !== (row.name ?? '') || phone !== (row.phone ?? ''));
  const amountsDirty =
    !!row &&
    (amount !== (row.amountPaid ? String(row.amountPaid) : '') ||
      expected !== (row.amountExpected ? String(row.amountExpected) : '') ||
      note !== (row.note ?? ''));
  const statusDirty = !!row && status !== row.status;
  const dirty = amountsDirty || statusDirty || guestDirty;
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

  const save = () => {
    if (!row) return;
    if (!name.trim()) {
      toast.error('Name is required.');
      return;
    }
    // Send only what changed. A status-only change must not rewrite the amounts,
    // and an amounts-only change lets the server reconcile the status.
    const patch: Record<string, unknown> = {};
    if (amountsDirty) {
      patch.amountPaid = paid;
      patch.amountExpected = want;
      patch.note = note.trim() || null;
    }
    if (statusDirty) patch.status = status;
    // Guest details are only sent when they actually changed, so an
    // amounts-only save never re-validates a number the tenant never touched.
    if (guestDirty) patch.guest = { name: name.trim(), phone: phone.trim() };
    void onSave(patch);
  };

  return (
    <AppBottomSheet
      open={!!row}
      onClose={onClose}
      title={row?.guestName}
      description={
        row && meta
          ? `${meta.label}${row.updatedByName ? ` · last updated by ${row.updatedByName}` : ''}`
          : undefined
      }
      footer={
        row ? (
          <div className="flex gap-2">
            <AppButton variant="ghost" onClick={onClose} fullWidth>
              Cancel
            </AppButton>
            <AppButton
              onClick={save}
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
                value={row.amountExpected ? formatTZS(row.amountExpected, currency) : 'Not set'}
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
                No number on file. Add one below so reminders and calls can reach this guest.
              </p>
            )}
          </section>

          {/* ── Guest details ── */}
          <section className="rounded-card border border-line bg-white p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Guest details
            </p>
            <div className="mt-3 space-y-3.5">
              <AppInput
                label="Full name"
                hint={
                  row.title
                    ? `Saved without the "${row.title}" title, which stays as it is.`
                    : 'Also updates this guest on your event guest list.'
                }
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                maxLength={120}
              />
              <AppInput
                label="Phone number"
                hint="Include country code, e.g. +255712345678. Leave empty if there is no number."
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+255712345678"
              />
            </div>
          </section>

          {/* ── Amounts ── */}
          <section className="rounded-card border border-line bg-white p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Contribution
            </p>
            <div className="mt-3 space-y-3.5">
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

              <div>
                <p className="mb-2 text-[13px] font-semibold text-ink">Status</p>
                <AppSegmentedControl
                  label="Contribution status"
                  value={status}
                  onChange={(value) => setStatus(value as ContributionStatus)}
                  options={[
                    {
                      value: 'PENDING',
                      label: 'Not started',
                      activeClassName: 'bg-muted',
                    },
                    {
                      value: 'PARTIAL',
                      label: 'Part paid',
                      activeClassName: 'bg-warn',
                    },
                    {
                      value: 'PAID',
                      label: 'Completed',
                      activeClassName: 'bg-success',
                    },
                  ]}
                />
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                  Any amount above zero records part payment. Reaching the expected target marks
                  the guest completed.
                </p>
              </div>

              {want && paid >= want ? (
                <p className="flex items-center gap-2 rounded-tap bg-success-soft px-3 py-2.5 text-[13px] text-success">
                  <Check size={14} />
                  This will be marked completed automatically.
                </p>
              ) : null}

              <AppInput
                label="Note"
                hint="Optional. Visible to the tenant only."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={200}
                placeholder="e.g. Paid via bank, confirmed 12 Nov"
              />
            </div>
          </section>
        </div>
      ) : null}
    </AppBottomSheet>
  );
}

// ─── Settings sheet ────────────────────────────────────────────────────────

function SettingsSheet({
  open,
  form,
  saving,
  trackerUrl,
  onChange,
  onSave,
  onClose,
}: {
  open: boolean;
  form: SettingsForm | null;
  saving: boolean;
  trackerUrl: string;
  onChange: (f: SettingsForm) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  if (!form) return null;

  const set = <K extends keyof SettingsForm>(key: K, value: SettingsForm[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <AppBottomSheet
      open={open}
      onClose={onClose}
      title="Contribution settings"
      description="Controls what the shared tracker can do."
      footer={
        <div className="flex gap-2">
          <AppButton variant="ghost" onClick={onClose} fullWidth>
            Cancel
          </AppButton>
          <AppButton onClick={onSave} loading={saving} loadingText="Saving" fullWidth>
            Save settings
          </AppButton>
        </div>
      }
    >
      <div className="space-y-4">
        <section className="rounded-card border border-line bg-surface-2 p-3.5">
          <AppCardTitle
            title="Tracking"
            subtitle="Publish the shared page and keep reminders accurate."
          />
          <div className="mt-3">
            <Toggle
              label="Enable tracking"
              description="Publishes the shared page and stops reminders going to guests who have paid in full."
              checked={form.contributionsEnabled}
              onChange={(v) => set('contributionsEnabled', v)}
            />
          </div>
        </section>

        <section className="rounded-card border border-line bg-white p-3.5">
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
          </div>
        </section>

        {trackerUrl ? (
          <section className="rounded-card border border-line bg-white p-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Shared tracker
            </p>
            <code className="mt-1 block break-all rounded-tap bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-muted">
              {trackerUrl}
            </code>
            <a
              href={trackerUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[13px] font-semibold text-brand"
            >
              Open tracker <ExternalLink size={13} aria-hidden="true" />
            </a>
          </section>
        ) : null}

        <p className="flex items-start gap-2 rounded-tap bg-brand-soft px-3 py-2.5 text-[12px] leading-relaxed text-brand">
          <SlidersHorizontal size={14} className="mt-0.5 shrink-0" />
          <span>
            Greetings, names, venue, address, the payment deadline and the contact number come
            from the event itself. Edit those from the reminder screen, where you can preview the
            finished message.
          </span>
        </p>
      </div>
    </AppBottomSheet>
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
