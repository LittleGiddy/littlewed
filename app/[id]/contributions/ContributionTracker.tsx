// app/[id]/contributions/ContributionTracker.tsx
//
// The event owner's contribution ledger. This link belongs to the wedding
// owner, not to the guests: they open it to record what they have actually
// received from each guest and watch the totals move.
//
// The hero, headline card and guest list come from the shared contribution
// shell (app/client/events/[id]/contributions/shell.tsx), which is also used by
// the signed-in tenant manager. Only the recording sheet and the name/number
// approval flow are specific to this shared link.
'use client';

import { useCallback, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Hourglass,
  Phone,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  AppAvatar,
  AppBottomSheet,
  AppButton,
  AppCard,
  AppChip,
} from '@/components/ui';
import {
  CONTRIBUTION_STATUS_META,
  formatTZS,
  type ContributionStatus,
} from '@/lib/contributions';
import { confirmToast } from '@/lib/confirmToast';
import {
  ContributionHero,
  ContributionSummaryCard,
  DetailTile,
  LedgerCard,
  QUICK_ADD,
  QuickAmountButton,
  STATUS_TONE,
  formatDate,
  remainingOf,
  type LedgerRow,
  type LedgerSummary,
} from '@/app/client/events/[id]/contributions/shell';

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

interface TrackerRow extends LedgerRow {
  /**
   * A name/phone proposal filed from this tracker that the event planner has
   * not answered yet. Null for everyone else - the guest list itself never
   * changes from here, only through an accepted request.
   */
  pendingEdit: { name: string; phone: string | null } | null;
}

interface TrackerPayload {
  event: TrackerEvent;
  summary: LedgerSummary;
  rows: TrackerRow[];
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

  const [savingId, setSavingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<TrackerRow | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  const progressPct =
    data.summary.target && data.summary.target > 0
      ? Math.min(100, Math.round((data.summary.collected / data.summary.target) * 100))
      : null;

  // Event Details is the single source of the event's name, so the heading is
  // that name verbatim. The occasion sits under it as context rather than
  // replacing it, which is what a ledger is titled with.
  const eventName = data.event.name || 'Contributions';
  const venue = data.event.venue || data.event.address;

  // The server echo replaces `rows`, so the open sheet reads the fresh copy
  // rather than the snapshot it was opened with.
  const editingLive = editing
    ? (data.rows.find((r) => r.guestId === editing.guestId) ?? editing)
    : null;

  return (
    <div className="min-h-dvh bg-canvas pb-16">
      <ContributionHero
        name={eventName}
        eventType={data.event.eventType}
        date={data.event.date}
        venue={venue}
      />

      <main className="relative mx-auto -mt-8 w-full max-w-3xl space-y-4 px-4 sm:px-6">
        <ContributionSummaryCard
          summary={data.summary}
          currency={currency}
          progressPct={progressPct}
        />

        <LedgerCard
          rows={data.rows}
          summary={data.summary}
          currency={currency}
          onOpenRow={setEditing}
          onRefresh={() => void refresh()}
          refreshing={refreshing}
          busyGuestId={savingId}
        />

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
