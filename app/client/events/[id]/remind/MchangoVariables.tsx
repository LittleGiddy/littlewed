// app/client/events/[id]/remind/MchangoVariables.tsx
'use client';

import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CalendarClock,
  Check,
  ChevronDown,
  RotateCcw,
  Search,
  Smartphone,
  UserRound,
  Users,
} from 'lucide-react';
import {
  AppCard,
  AppChip,
  AppField,
  AppInput,
  AppSelect,
  fieldClasses,
} from '@/components/ui';
import {
  MCHANGO_FIELDS,
  MCHANGO_FIELD_GROUPS,
  hasMchangoOverride,
  missingMchangoFields,
  renderMchangoPreviewRuns,
  resolveMchangoValues,
  type MchangoEventSource,
  type MchangoFieldKey,
  type MchangoValues,
} from '@/lib/whatsapp/mchango';

/** A guest the tenant can preview the greeting with. */
export interface MchangoGuest {
  id: string;
  name: string;
  title?: string | null;
}

const GROUP_ICONS: Record<string, typeof Users> = {
  occasion: Users,
  details: CalendarClock,
  payment: Banknote,
  contact: Smartphone,
};

type Overrides = Partial<Record<MchangoFieldKey, string>>;

/**
 * Trims each override but KEEPS the empty ones.
 *
 * An absent key means "never touched, fall back to the event"; an empty key
 * means "I cleared this on purpose". Dropping empties here made every prefilled
 * value impossible to remove, because clearing a field quietly handed the event
 * value straight back.
 */
function normaliseOverrides(overrides: Overrides): Overrides {
  const out: Overrides = {};
  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'string') out[key as MchangoFieldKey] = value.trim();
  }
  return out;
}

/** A <input type="date"> only understands YYYY-MM-DD, but the resolved slot is
 *  the Swahili form ("25 Novemba 2026"). Both sides convert at the boundary, so
 *  a date box reads the RAW override rather than the resolved slot. */
function toInputDate(value: Date | string | null | undefined): string {
  if (!value || value === '—') return '';
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

interface Props {
  event: MchangoEventSource;
  /** Tenant edits. A key absent here means "use the event value". */
  overrides: Overrides;
  onChange: (next: Overrides) => void;
  /** The event's guests, so var2 can be picked from the real list. */
  guests: MchangoGuest[];
  /** Which guest the preview greets. Null until one is chosen. */
  previewGuestId: string | null;
  onPreviewGuestChange: (guestId: string | null) => void;
  saving: boolean;
}

export default function MchangoVariables({
  event,
  overrides,
  onChange,
  guests,
  previewGuestId,
  onPreviewGuestChange,
  saving,
}: Props) {
  const clean = useMemo(() => normaliseOverrides(overrides), [overrides]);

  const previewGuest = useMemo(
    () => guests.find((g) => g.id === previewGuestId) ?? null,
    [guests, previewGuestId]
  );

  // var2 is the guest's own name, so the preview resolves against the guest being
  // previewed rather than against the event. This is the same resolution the send
  // path does per recipient, which is what keeps the preview honest.
  const greetingForPreview = previewGuest
    ? previewGuest.title
      ? `${previewGuest.title} ${previewGuest.name}`
      : previewGuest.name
    : undefined;

  // Resolved on every keystroke, so the preview can never disagree with the form.
  const values: MchangoValues = useMemo(
    () => resolveMchangoValues(event, clean, greetingForPreview),
    [event, clean, greetingForPreview]
  );
  const previewRuns = useMemo(() => renderMchangoPreviewRuns(values), [values]);
  const missing = useMemo(() => missingMchangoFields(values), [values]);

  const editedCount = Object.keys(clean).length;

  const setField = (key: MchangoFieldKey, value: string) => {
    // The key is kept even when the box is empty: that is the tenant's decision
    // to leave the slot out, not a request to fall back to the event.
    onChange({ ...overrides, [key]: value });
  };

  const resetField = (key: MchangoFieldKey) => {
    const next = { ...overrides };
    delete next[key];
    onChange(next);
  };

  const resetAll = () => onChange({});

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
      {/* ─── Fields ────────────────────────────────────────────────── */}
      <div className="space-y-4">
        {MCHANGO_FIELD_GROUPS.map((group) => {
          const fields = MCHANGO_FIELDS.filter((f) => f.group === group.key);
          if (fields.length === 0) return null;
          const Icon = GROUP_ICONS[group.key];

          return (
            <AppCard key={group.key} tone="plain" padded={false}>
              <div className="flex items-start gap-2.5 border-b border-line px-4 py-3.5">
                <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-tap bg-brand-50 text-brand">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[13px] font-semibold text-ink">{group.label}</h3>
                  <p className="mt-0.5 text-[11px] text-muted">{group.description}</p>
                </div>
              </div>

              <div className="grid gap-3.5 p-4 sm:grid-cols-2">
                {fields.map((field) => {
                  const hasOverride = hasMchangoOverride(clean, field.key);
                  const isCleared = hasOverride && clean[field.key] === '';
                  const isMissing = missing.includes(field.key);
                  const current = values[field.key];
                  // A per-guest slot has nothing to clear or restore: it is filled
                  // from the guest list at send time, not typed here.
                  const isPerGuest = field.kind === 'guest';

                  return (
                    <div key={field.key} className={field.kind === 'text' && field.placeholder.length > 30 ? 'sm:col-span-2' : ''}>
                      <AppField
                        label={
                          <span className="flex flex-wrap items-center gap-1.5">
                            {field.label}
                            <span className="font-mono text-[10px] font-normal text-muted">
                              {field.varKey}
                            </span>
                            {isPerGuest ? (
                              <span className="text-[10px] font-medium text-brand">
                                per guest
                              </span>
                            ) : hasOverride ? (
                              <span className="text-[10px] font-semibold text-brand">
                                {isCleared ? 'cleared' : 'edited'}
                              </span>
                            ) : field.fromEvent ? (
                              <span className="text-[10px] font-medium text-muted">
                                from event
                              </span>
                            ) : null}
                          </span>
                        }
                        hint={
                          isPerGuest ? (
                            <span className="flex flex-wrap items-center gap-x-2">
                              <span>
                                {previewGuest
                                  ? 'Previewing as this guest. Each guest receives their own name.'
                                  : 'Pick a guest to see the greeting.'}
                              </span>
                              {hasOverride ? (
                                <button
                                  type="button"
                                  onClick={() => resetField(field.key)}
                                  className="font-semibold text-brand underline decoration-dotted underline-offset-2 hover:text-ink"
                                >
                                  Use each guest&apos;s own name
                                </button>
                              ) : null}
                            </span>
                          ) : hasOverride ? (
                            // The way back to the event's own value, per field.
                            // Without it, clearing a box would be a one-way door.
                            <span className="flex flex-wrap items-center gap-x-2">
                              <span>
                                {isCleared
                                  ? 'Left out — the guest sees a dash here.'
                                  : 'Sending your value.'}
                              </span>
                              <button
                                type="button"
                                onClick={() => resetField(field.key)}
                                className="font-semibold text-brand underline decoration-dotted underline-offset-2 hover:text-ink"
                              >
                                Use event value
                              </button>
                            </span>
                          ) : isMissing ? (
                            'Still empty — the guest sees a dash.'
                          ) : (
                            field.hint
                          )
                        }
                      >
                        {({ id }) =>
                          isPerGuest ? (
                            <GuestPicker
                              id={id}
                              guests={guests}
                              selected={previewGuest}
                              onSelect={onPreviewGuestChange}
                            />
                          ) : field.kind === 'select' ? (
                            <AppSelect
                              id={id}
                              value={current}
                              onChange={(e) => setField(field.key, e.target.value)}
                            >
                              <option value="">Not set</option>
                              {/* An eventType stored before this list existed would
                                  otherwise render as a blank select and read as
                                  "missing" while the send still used it. */}
                              {current && !field.options?.includes(current) ? (
                                <option value={current}>{current} (from event)</option>
                              ) : null}
                              {field.options?.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </AppSelect>
                          ) : (
                            <AppInput
                              id={id}
                              type={field.kind === 'date' ? 'date' : 'text'}
                              inputMode={field.kind === 'tel' ? 'tel' : undefined}
                              value={
                                field.kind === 'date'
                                  ? toInputDate(
                                      hasOverride
                                        ? clean[field.key]
                                        : field.key === 'date'
                                          ? event.date
                                          : event.contributionDeadline
                                    )
                                  : current
                              }
                              onChange={(e) => setField(field.key, e.target.value)}
                              placeholder={field.placeholder}
                            />
                          )
                        }
                      </AppField>
                    </div>
                  );
                })}
              </div>
            </AppCard>
          );
        })}

        {editedCount > 0 ? (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-tap px-3 text-xs font-semibold text-muted transition-colors hover:text-ink"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
            Reset {editedCount} change{editedCount > 1 ? 's' : ''} back to the event details
          </button>
        ) : null}
      </div>

      {/* ─── Preview ────────────────────────────────────────────────── */}
      <div className="lg:sticky lg:top-20">
        <AppCard tone="raised" padded={false} className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <Smartphone className="size-4 text-muted" aria-hidden="true" />
              <h3 className="text-[13px] font-semibold text-ink">Preview</h3>
            </div>
            {saving ? (
              <AppChip tone="neutral">Saving</AppChip>
            ) : missing.length === 0 ? (
              <AppChip tone="success" icon={<Check className="size-3" />}>
                All set
              </AppChip>
            ) : (
              <AppChip tone="warn">{missing.length} empty</AppChip>
            )}
          </div>

          {/* WhatsApp-style chat: wallpaper, sender row, body bubble. */}
          <div className="bg-[#e7f7ec] p-3">
            <div className="mb-2 flex items-center gap-2 px-1">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#25D366] text-white">
                <Banknote className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold text-gray-800">Mchango</p>
                <p className="truncate text-[10px] text-gray-500">
                  {previewGuest
                    ? `Previewing as ${previewGuest.title ? `${previewGuest.title} ` : ''}${previewGuest.name}`
                    : 'Pick a guest above to preview the greeting'}
                </p>
              </div>
            </div>

            <div className="rounded-2xl rounded-tl-sm bg-white p-3.5 text-[13px] leading-[1.6] text-gray-800 shadow-sm">
              {previewRuns.length > 0 ? (
                // The asterisks are WhatsApp bold markers, so they are rendered as
                // weight here instead of being shown as literal characters.
                <p className="whitespace-pre-wrap break-words">
                  {previewRuns.map((run, i) =>
                    run.bold ? (
                      <strong key={i} className="font-bold">
                        {run.text}
                      </strong>
                    ) : (
                      <span key={i}>{run.text}</span>
                    )
                  )}
                </p>
              ) : (
                <p className="text-gray-400">Nothing to preview yet.</p>
              )}
              <p className="mt-2 text-right text-[10px] text-gray-400">
                {new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {missing.length > 0 ? (
              <div className="mt-2.5 flex items-start gap-2 rounded-tap bg-white/70 p-2.5">
                <AlertCircle
                  className="mt-0.5 size-3.5 shrink-0 text-warn"
                  aria-hidden="true"
                />
                <p className="text-[11px] leading-relaxed text-gray-600">
                  Not filled in, so the guest sees a dash instead:{' '}
                  <span className="font-semibold">
                    {missing.map((k) => MCHANGO_FIELDS.find((f) => f.key === k)?.label).join(', ')}
                  </span>
                </p>
              </div>
            ) : null}
          </div>

          <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-muted">
            The greeting is the only per-guest part: every guest receives their own name. Every other
            slot is exactly what the fields on the left say — clear one and it is left out.
          </p>
        </AppCard>
      </div>
    </div>
  );
}

/**
 * var2's control: the event's real guests, searchable.
 *
 * A free-text box would let the tenant type a name that is not on the guest list,
 * and since the send resolves this slot per recipient from the guest rows, that
 * typed value would be the one thing in the message with no guest behind it.
 */
function GuestPicker({
  id,
  guests,
  selected,
  onSelect,
}: {
  id: string;
  guests: MchangoGuest[];
  selected: MchangoGuest | null;
  onSelect: (guestId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        g.name.toLowerCase().includes(q) || (g.title ?? '').toLowerCase().includes(q)
    );
  }, [guests, query]);

  const label = selected
    ? `${selected.title ? `${selected.title} ` : ''}${selected.name}`
    : guests.length > 0
      ? 'Select a guest…'
      : 'No guests yet';

  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className={`${fieldClasses} flex items-center gap-2 text-left ${open ? 'border-brand ring-4 ring-brand/10' : ''}`}
      >
        <UserRound size={15} className="shrink-0 text-muted" aria-hidden="true" />
        <span className={`min-w-0 flex-1 truncate ${selected ? '' : 'text-gray-300'}`}>{label}</span>
        <ChevronDown size={15} className="shrink-0 text-muted" aria-hidden="true" />
      </button>

      {open ? (
        <>
          {/* Click-away layer. */}
          <div
            className="fixed inset-0 z-10"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="absolute z-20 mt-1 w-full rounded-tap border border-gray-200 bg-white shadow-lg">
            <div className="relative border-b border-line p-2">
              <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search guests"
                className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-2 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10"
              />
            </div>
            <ul role="listbox" className="max-h-56 overflow-y-auto py-1">
              {matches.length === 0 ? (
                <li className="px-3 py-2 text-xs text-gray-400">
                  {guests.length === 0 ? 'Import guests to preview the greeting.' : 'No guest matches.'}
                </li>
              ) : (
                matches.map((g) => {
                  const isOn = g.id === selected?.id;
                  return (
                    <li key={g.id}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isOn}
                        onClick={() => {
                          onSelect(g.id);
                          setOpen(false);
                          setQuery('');
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          isOn ? 'bg-brand-50 text-brand' : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {g.title ? <span className="text-muted">{g.title} </span> : null}
                          {g.name}
                        </span>
                        {isOn ? <Check size={14} className="shrink-0" aria-hidden="true" /> : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
