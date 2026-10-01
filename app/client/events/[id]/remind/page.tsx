'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, ArrowRight, Send, Loader2, Users, CheckSquare, Square,
  MessageCircle, Phone, Info, Gift, Bell, Search,
  Hash, Coins, ShieldCheck, Save, Check, CircleCheck, CircleX,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';
import { isContributionSettled } from '@/lib/contributions';
import { AppSegmentedControl, AppProgressBar, ShareLinkButton } from '@/components/ui';
import SmsCounter from '@/components/SmsCounter';
import { MAX_SMS_PARTS_PER_GUEST } from '@/lib/sms/units';
import ReminderCardDesigner, {
  DEFAULT_REMINDER_DESIGN,
  type ReminderDesign,
} from './ReminderCardDesigner';
import MchangoVariables from './MchangoVariables';
import ReminderCardPreview from './ReminderCardPreview';
import type { MchangoEventSource, MchangoFieldKey } from '@/lib/whatsapp/mchango';

/** Where the typed SMS reminder is kept so it survives a reload. */
const SMS_DRAFT_KEY = (eventId: string) => `reminder_sms_draft_${eventId}`;

/** The request asks for a progress stream; the route falls back to plain JSON. */
const NDJSON_MEDIA_TYPE = 'application/x-ndjson';

/** Live send progress, drawn from the route's newline-delimited stream. */
interface SendProgress {
  total: number;
  processed: number;
  sent: number;
  failed: number;
  lastName?: string;
}

/** The summary the route returns once the send is over. */
interface ReminderSummary {
  success?: boolean;
  error?: string;
  successCount?: number;
  totalCost?: number;
  chargedCount?: number;
  refundedCount?: number;
  creditsRefunded?: number;
  remainingCredits?: number;
  skippedSettledCount?: number;
  errors?: Array<{ guestId: string; error?: string }>;
}

type ReminderStreamEvent =
  | { type: 'start'; total?: number }
  | {
      type: 'progress';
      name?: string;
      processed?: number;
      sent?: number;
      failed?: number;
      total?: number;
    }
  | ({ type: 'done' } & ReminderSummary)
  | { type: 'error'; error?: string };

interface Guest {
  id: string;
  name: string;
  title?: string | null;
  phone: string | null;
  reminderCount: number;
  routingChannel: string;
  cardNumber?: string | null;
  /** Present when contribution tracking is on for this event. */
  contribution?: {
    status: string;
    amountPaid: number;
    amountExpected: number | null;
  } | null;
}

interface EventData {
  id: string;
  name: string;
  manualReminderSent?: boolean;
  contributionsEnabled?: boolean;
  reminderCardUrl?: string | null;
  reminderCardNameX?: number | null;
  reminderCardNameY?: number | null;
  reminderCardNameSize?: number | null;
  reminderCardNameColor?: string | null;
  reminderCardNameAlign?: string | null;
  reminderCardNameFont?: string | null;
  // Mchango template variables (var1..var13). Seeded into the editor; a typed
  // override wins over these for the send.
  eventType?: string | null;
  hostFamily?: string | null;
  person1?: string | null;
  person2?: string | null;
  venue?: string | null;
  address?: string | null;
  date?: string | null;
  contributionDeadline?: string | null;
  mpesaInstructions?: string | null;
  airtelInstructions?: string | null;
  bankInstructions?: string | null;
  contactPerson?: string | null;
  contactPersonPhone?: string | null;
}

type Channel = 'whatsapp' | 'sms';

const FREE_REMINDERS_PER_GUEST = 2;
const REMINDER_COST = 50;

export default function RemindGuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [eventId, setEventId] = useState<string | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  /** Live progress while a send is in flight. Null whenever nothing is sending. */
  const [progress, setProgress] = useState<SendProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<number | null>(null);
  const [bypassPayment, setBypassPayment] = useState(false);
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState('');
  const [savingDesign, setSavingDesign] = useState(false);

  // Reminder card + name placement
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const [design, setDesign] = useState<ReminderDesign>(DEFAULT_REMINDER_DESIGN);

  // Tenant-typed Mchango variable overrides. Only keys the tenant actually
  // changed are held here, so everything else tracks the event row live.
  const [mchangoOverrides, setMchangoOverrides] = useState<
    Partial<Record<MchangoFieldKey, string>>
  >({});
  const [savingVariables, setSavingVariables] = useState(false);

  /** Which guest the message preview greets by name. */
  const [previewGuestId, setPreviewGuestId] = useState<string | null>(null);

  /** The event shaped the way the Mchango resolver reads it. */
  const mchangoEvent: MchangoEventSource | null = useMemo(() => {
    if (!event) return null;
    return {
      name: event.name ?? '',
      eventType: event.eventType,
      hostFamily: event.hostFamily,
      person1: event.person1,
      person2: event.person2,
      venue: event.venue,
      address: event.address,
      date: event.date ?? '',
      contributionDeadline: event.contributionDeadline,
      mpesaInstructions: event.mpesaInstructions,
      airtelInstructions: event.airtelInstructions,
      bankInstructions: event.bankInstructions,
      contactPerson: event.contactPerson,
      contactPersonPhone: event.contactPersonPhone,
    };
  }, [event]);

  // ─── Remember the SMS reminder between visits ─────────────────────────
  // A typed reminder is expensive to recreate — the payment details, the date and
  // the wording are all retyped — so the draft is written on every keystroke and
  // read back on load. This follows the invitation composer's draft keys so there
  // is one place to look for "my unsent message".
  const draftReady = useRef(false);

  useEffect(() => {
    if (!eventId || !draftReady.current) return;
    try {
      // An emptied box removes the key, so a later visit starts clean rather than
      // restoring an empty reminder.
      if (message.trim()) window.localStorage.setItem(SMS_DRAFT_KEY(eventId), message);
      else window.localStorage.removeItem(SMS_DRAFT_KEY(eventId));
    } catch {
      // Storage unavailable - the message still works, it just will not persist.
    }
  }, [eventId, message]);

  const fetchEvent = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/events/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load event');
      const data = await res.json();
      setEvent(data.event);
      setGuests(data.guests || []);
      setBypassPayment(!!data.bypassPayment);
      if (data.event?.reminderCardUrl) {
        setCardUrl(data.event.reminderCardUrl);
        // Every fallback comes from DEFAULT_REMINDER_DESIGN rather than being
        // spelled out here, because that object is the one documented as having
        // to match reminderCardName*'s column defaults and the server's own
        // fallbacks. A literal here drifts: it used to open at y=42 while the
        // server drew at 40, so an untouched name appeared 2% low in the designer
        // and the guest never saw that position at all.
        setDesign({
          x: data.event.reminderCardNameX ?? DEFAULT_REMINDER_DESIGN.x,
          y: data.event.reminderCardNameY ?? DEFAULT_REMINDER_DESIGN.y,
          size: data.event.reminderCardNameSize ?? DEFAULT_REMINDER_DESIGN.size,
          color: data.event.reminderCardNameColor ?? DEFAULT_REMINDER_DESIGN.color,
          align:
            data.event.reminderCardNameAlign === 'left' || data.event.reminderCardNameAlign === 'right'
              ? data.event.reminderCardNameAlign
              : DEFAULT_REMINDER_DESIGN.align,
          font: data.event.reminderCardNameFont ?? DEFAULT_REMINDER_DESIGN.font,
        });
      }

      // The saved SMS draft is read here, with the rest of the page's data, so
      // the textbox starts out holding what was last typed. Reading it in its own
      // effect would set state on every mount as well as after each send refresh.
      try {
        const saved = window.localStorage.getItem(SMS_DRAFT_KEY(id));
        if (saved) setMessage((current) => (current ? current : saved));
      } catch {
        // Private mode or a full quota: losing the draft is not worth an error.
      }
      // The draft has now been read, so the write effect may start saving.
      draftReady.current = true;
    } catch {
      toast.error('Could not load event data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    params.then(({ id }) => {
      setEventId(id);
      fetchEvent(id);
      fetch('/api/tenant/billing', { credentials: 'include' })
        .then((r) => r.json())
        .then((d) => setCredits(d.tenant?.credits ?? 0))
        .catch(() => {});
    });
  }, [params, fetchEvent]);

  // Every guest is offered on the "Pick guests" step, whichever channel the
  // reminder goes out over - matching the SMS reminder screen. Routing is shown
  // as a badge so the user still knows how each guest is normally contacted.
  // Guests without a phone number are excluded because the provider can't
  // reach them, and offering them would be a dead end.
  const contactsOnly = useMemo(() => guests.filter((g) => !!g.phone), [guests]);

  // Anyone who has already settled their contribution is removed from the list
  // entirely. Reminding someone who has paid wastes their money and the
  // tenant's credits, and offering them the option invites the mistake. The API
  // enforces the same rule, so a stale tab cannot slip a paid guest through.
  const settledGuests = useMemo(
    () =>
      event?.contributionsEnabled
        ? contactsOnly.filter((g) => isContributionSettled(g.contribution))
        : [],
    [contactsOnly, event?.contributionsEnabled]
  );

  const remindableGuests = useMemo(
    () => (event?.contributionsEnabled ? contactsOnly.filter((g) => !settledGuests.some((s) => s.id === g.id)) : contactsOnly),
    [contactsOnly, event?.contributionsEnabled, settledGuests]
  );

  const filteredGuests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return remindableGuests;
    return remindableGuests.filter(
      (g) => g.name.toLowerCase().includes(q) || (g.phone || '').includes(q)
    );
  }, [remindableGuests, search]);

  // Once-per-event lock: non-bypassed tenants can use the manual reminder once.
  const alreadyUsed = !bypassPayment && !!event?.manualReminderSent;

  const selected = useMemo(
    () => remindableGuests.filter((g) => selectedGuests.has(g.id)),
    [remindableGuests, selectedGuests]
  );

  // Cost: first 2 reminders per guest are free, then 50 credits each.
  const totalCost = useMemo(
    () => selected.reduce((sum, g) => sum + (g.reminderCount < FREE_REMINDERS_PER_GUEST ? 0 : REMINDER_COST), 0),
    [selected]
  );
  const insufficientCredits = totalCost > 0 && credits !== null && credits < totalCost;

  // A representative name so the canvas previews the real result, not a token.
  // The selected guest wins when there is one; otherwise it falls back to the
  // guest picked for the WhatsApp preview so the card and the message greet the
  // same person.
  const sampleName = useMemo(() => {
    const first = selected[0];
    if (first) return first.title ? `${first.title} ${first.name}` : first.name;
    const previewed = remindableGuests.find((g) => g.id === previewGuestId);
    if (previewed) return previewed.title ? `${previewed.title} ${previewed.name}` : previewed.name;
    const anyGuest = remindableGuests[0];
    if (anyGuest) return anyGuest.title ? `${anyGuest.title} ${anyGuest.name}` : anyGuest.name;
    return 'John Doe';
  }, [selected, remindableGuests, previewGuestId]);

  // ─── Step model ────────────────────────────────────────────────────────
  // WhatsApp: 0 pick the card (which also places the name) · 1 fill the
  //            message variables · 2 pick guests
  // SMS:      0 write the message · 1 pick guests
  const stepLabels = channel === 'whatsapp'
    ? ['Card', 'Message', 'Guests']
    : ['Message', 'Guests'];
  const lastStep = stepLabels.length - 1;

  const selectChannel = (c: Channel) => {
    setChannel(c);
    setSelectedGuests(new Set());
    setSearch('');
    setStep(0);
  };

  // A WhatsApp reminder without a card can't show a name, so block the later
  // steps until one is chosen.
  const canOpenStep = (index: number) => {
    if (channel === 'whatsapp' && index >= 1 && !cardUrl) return false;
    return true;
  };

  const toggleSelectAll = () => {
    if (selectedGuests.size === remindableGuests.length) setSelectedGuests(new Set());
    else setSelectedGuests(new Set(remindableGuests.map((g) => g.id)));
  };

  const toggleSelectGuest = (id: string) => {
    setSelectedGuests((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Persist the design before it can be used to send ─────────────────
  const persistDesign = useCallback(async (): Promise<boolean> => {
    if (!eventId || channel !== 'whatsapp') return true;
    setSavingDesign(true);
    try {
      const res = await fetch(`/api/events/${eventId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminderCardUrl: cardUrl,
          reminderCardNameX: design.x,
          reminderCardNameY: design.y,
          reminderCardNameSize: design.size,
          reminderCardNameColor: design.color,
          reminderCardNameAlign: design.align,
          reminderCardNameFont: design.font,
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Could not save the card design');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the card design.');
      return false;
    } finally {
      setSavingDesign(false);
    }
  }, [eventId, channel, cardUrl, design]);

  // ─── Persist the template variables ───────────────────────────────────
  // Only the slots the tenant actually changed are sent, so untouched slots keep
  // whatever the event already held and a half-filled form cannot blank out the
  // rest. The values are written to the Event columns (rather than kept in
  // localStorage like the invitation composer) because the send path and the
  // public contribution tracker both read them from the database.
  //
  // A cleared field is a change too: it arrives here as an empty string and the
  // settings route turns that into NULL, which is how a prefilled value finally
  // gets removed from the event rather than being re-seeded on the next load.
  const persistVariables = useCallback(async (): Promise<boolean> => {
    if (!eventId || channel !== 'whatsapp') return true;
    const keys = Object.keys(mchangoOverrides) as MchangoFieldKey[];
    if (keys.length === 0) return true;

    setSavingVariables(true);
    try {
      const body: Record<string, string> = {};
      for (const key of keys) {
        const value = mchangoOverrides[key];
        if (value === undefined) continue;
        // Trimmed here rather than in the form: the box has to keep its spaces
        // while being typed, but a leading or trailing space written to the event
        // would show up in every other screen that reads the column.
        const trimmed = value.replace(/^\s+/, '').replace(/\s+$/, '');
        switch (key) {
          case 'occasion':
            body.eventType = trimmed;
            break;
          case 'deadline':
            body.contributionDeadline = trimmed;
            break;
          case 'mpesa':
            body.mpesaInstructions = trimmed;
            break;
          case 'airtel':
            body.airtelInstructions = trimmed;
            break;
          case 'bank':
            body.bankInstructions = trimmed;
            break;
          case 'familyName':
            body.hostFamily = trimmed;
            break;
          case 'celebrant':
            body.person2 = trimmed;
            break;
          case 'venue':
            body.venue = trimmed;
            break;
          case 'contact':
            body.contactPersonPhone = trimmed;
            break;
          case 'address':
            body.address = trimmed;
            break;
          // greetingName, eventName and date are display-only overrides: they
          // change this send without rewriting the event the rest of the app
          // reads from. Renaming the event from the reminder screen would
          // silently retitle it everywhere.
          default:
            break;
        }
      }
      if (Object.keys(body).length === 0) return true;

      const res = await fetch(`/api/events/${eventId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Could not save the message details');
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the message details.');
      return false;
    } finally {
      setSavingVariables(false);
    }
  }, [eventId, channel, mchangoOverrides]);

  const goNext = async () => {
    if (channel === 'whatsapp' && step === 0) {
      const ok = await persistDesign();
      if (!ok) return;
    }
    if (channel === 'whatsapp' && step === 1) {
      const ok = await persistVariables();
      if (!ok) return;
    }
    setStep((s) => Math.min(lastStep, s + 1));
  };

  /**
   * Reads the newline-delimited progress stream the route streams back.
   *
   * The route returns a plain JSON body instead when it rejects the request early
   * (auth, credits, the once-per-event lock), so a non-stream content type is
   * handled here as an error rather than parsed as progress.
   */
  const streamProgress = async (res: Response): Promise<ReminderSummary> => {
    const contentType = res.headers.get('content-type') ?? '';

    if (!contentType.includes(NDJSON_MEDIA_TYPE)) {
      // The route rejected the request before it started streaming (auth, credits,
      // the once-per-event lock), so the body is a plain JSON error.
      const data = (await res.json().catch(() => ({}))) as ReminderSummary;
      if (!res.ok) throw new Error(data.error || 'Failed to send reminders.');
      return data;
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('This browser cannot read the send progress.');

    const decoder = new TextDecoder();
    let buffer = '';
    let summary: ReminderSummary | null = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // A chunk can end mid-line, so only whole lines are consumed and the rest
      // stays buffered for the next read.
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let event: ReminderStreamEvent;
        try {
          event = JSON.parse(trimmed) as ReminderStreamEvent;
        } catch {
          continue;
        }

        if (event.type === 'start') {
          setProgress({ total: event.total ?? 0, processed: 0, sent: 0, failed: 0 });
        } else if (event.type === 'progress') {
          setProgress({
            total: event.total ?? 0,
            processed: event.processed ?? 0,
            sent: event.sent ?? 0,
            failed: event.failed ?? 0,
            lastName: event.name,
          });
        } else if (event.type === 'done') {
          summary = event;
        } else if (event.type === 'error') {
          throw new Error(event.error || 'Sending failed');
        }
      }
    }

    if (!summary) throw new Error('The send ended before it finished. Please check the guest list.');
    return summary;
  };

  const sendReminders = async () => {
    if (alreadyUsed) {
      toast.error('Reminder messages have already been sent for this event.');
      return;
    }
    if (selectedGuests.size === 0) {
      toast.error('Please select at least one guest.');
      return;
    }
    if (channel === 'sms' && !message.trim()) {
      toast.error('Please enter a message.');
      return;
    }
    if (channel === 'whatsapp' && !cardUrl) {
      toast.error('Choose or upload a reminder card first.');
      setStep(0);
      return;
    }
    if (insufficientCredits) {
      toast.error(`Insufficient credits. Need ${totalCost}, you have ${credits}.`);
      return;
    }

    // The card must be saved before we start rendering per-guest cards.
    if (channel === 'whatsapp' && !(await persistDesign())) return;
    const costText = totalCost === 0 ? 'Free' : `${totalCost} credits`;
    const ok = await confirmToast({
      title: `Send ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} reminder to ${selectedGuests.size} guest${selectedGuests.size > 1 ? 's' : ''}?`,
      message: `Cost: ${costText}.`,
      confirmText: 'Send',
    });
    if (!ok) return;

    setSending(true);
    setProgress({ total: selectedGuests.size, processed: 0, sent: 0, failed: 0 });
    try {
      const res = await fetch(`/api/events/${eventId}/send-reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: NDJSON_MEDIA_TYPE },
        body: JSON.stringify({
          guestIds: Array.from(selectedGuests),
          message,
          channel,
          // The overrides travel with the send so the delivered message is
          // built from exactly the values shown in the preview, whether or not
          // the tenant stepped through and saved them.
          variables: channel === 'whatsapp' ? mchangoOverrides : undefined,
        }),
        credentials: 'include',
      });
      const data = await streamProgress(res);
      if (!data.success) {
        toast.error(data.error || 'Failed to send reminders.');
        return;
      }

      const sent = data.successCount ?? 0;
      const total = selectedGuests.size;
      if (sent === total) toast.success(`Reminder sent to ${sent} guest${sent > 1 ? 's' : ''}.`);
      else toast.success(`Reminder sent to ${sent}/${total} guests.`);

      // Guests paid in full are skipped server-side too. Say so, otherwise the
      // gap between "selected" and "sent" looks like a delivery failure.
      const skippedSettled = data.skippedSettledCount ?? 0;
      if (skippedSettled > 0) {
        toast.success(
          `${skippedSettled} guest${skippedSettled > 1 ? 's were' : ' was'} skipped - contribution already completed.`
        );
      }

      // Tell the user when a failed send gave credits back, so the balance on
      // screen is never a surprise.
      const creditsRefunded = data.creditsRefunded ?? 0;
      if (creditsRefunded > 0) {
        const refundedCount = data.refundedCount ?? 0;
        toast.success(
          `${creditsRefunded} credits refunded for ${refundedCount} failed send${refundedCount > 1 ? 's' : ''}.`
        );
      }
      if (data.errors?.length) {
        console.error('Reminder errors:', data.errors);
        toast.error('Some messages did not send. Check the guest list and try again.');
      }
      if (typeof data.remainingCredits === 'number') setCredits(data.remainingCredits);

      await fetchEvent(eventId!);
      router.push(`/client/events/${eventId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Network error. Please try again.');
    } finally {
      setSending(false);
      setProgress(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] bg-canvas">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-canvas flex flex-col items-center justify-center text-center px-6">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <Bell size={28} className="text-gray-400" />
        </div>
        <p className="text-gray-500 mt-3">Event not found.</p>
        <Link href="/client/dashboard" className="text-brand underline mt-2 inline-block">
          Go back
        </Link>
      </div>
    );
  }

  const canSend =
    !alreadyUsed &&
    selectedGuests.size > 0 &&
    !insufficientCredits &&
    (channel === 'whatsapp' ? !!cardUrl : !!message.trim());

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      {/* ─── App bar ─── */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-gray-200/70">
        <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 h-14 flex items-center gap-2 sm:gap-3">
          <Link
            href={`/client/events/${eventId}`}
            className="w-9 h-9 rounded-tap border border-gray-200 flex items-center justify-center text-gray-600 active:scale-95 transition shrink-0"
          >
            <ArrowLeft size={17} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-semibold text-sm sm:text-base text-gray-900 truncate leading-tight">
              Remind guests
            </h1>
            <p className="text-[11px] text-gray-500 truncate">{event.name}</p>
          </div>
          {!bypassPayment && credits !== null && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-warn bg-warn-soft border border-warn-border rounded-full px-2.5 py-1 shrink-0">
              <Coins size={11} />
              {credits.toLocaleString()}
            </span>
          )}
          {bypassPayment && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-success bg-success-soft border border-success-border rounded-full px-2.5 py-1 shrink-0">
              <ShieldCheck size={11} /> Pro
            </span>
          )}
        </div>
      </header>

        <main className="flex-1 pb-28">
          <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 py-4 space-y-4">
          {/* Contribution tracker entry point + share */}
          {event?.contributionsEnabled && eventId ? (
            <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <Coins size={16} className="mt-0.5 shrink-0 text-brand" />
                <div>
                  <p className="text-xs font-semibold text-ink">Contribution tracker is live</p>
                  <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted">
                    Share the link so your client can mark who has paid.
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                <ShareLinkButton
                  url={`${typeof window !== 'undefined' ? window.location.origin : ''}/${eventId}/contributions`}
                  title={`${event.name} contributions`}
                  text="Track who has completed their contribution."
                  label="Share link"
                  variant="primary"
                  size="sm"
                />
                <Link
                  href={`/client/events/${eventId}/contributions`}
                  className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-tap bg-surface-2 px-3.5 text-xs font-semibold text-ink ring-1 ring-inset ring-line transition-colors hover:bg-brand-50"
                >
                  Review
                </Link>
              </div>
            </div>
          ) : null}

          {alreadyUsed && (
            <div className="bg-warn-soft border border-warn-border rounded-card p-3 flex items-start gap-2.5">
              <Bell size={16} className="text-warn shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Already sent.</span> Reminders can only be sent once per event.
              </p>
            </div>
          )}

          {/* Settled guests: hidden from the picker, but never silently so. */}
          {event?.contributionsEnabled && settledGuests.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-card border border-success-border bg-success-soft p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success" />
                <div>
                  <p className="text-xs font-semibold text-success">
                    {settledGuests.length} guest{settledGuests.length > 1 ? 's' : ''} already paid in full
                  </p>
                  <p className="mt-0.5 text-[0.7rem] leading-relaxed text-success/80">
                    Hidden from this list so nobody is reminded twice.
                  </p>
                </div>
              </div>
              <Link
                href={`/client/events/${eventId}/contributions`}
                className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-tap bg-white px-3.5 text-xs font-semibold text-success ring-1 ring-inset ring-success-border transition-colors hover:bg-success-soft"
              >
                <Coins size={14} aria-hidden="true" />
                Review statuses
              </Link>
            </div>
          ) : null}

          {/* ─── Channel switch ─── */}
          <AppSegmentedControl
            label="Reminder channel"
            value={channel}
            onChange={(v) => selectChannel(v as Channel)}
            size="lg"
            options={[
              {
                value: 'whatsapp',
                label: 'WhatsApp',
                icon: <MessageCircle className="size-4" />,
                activeClassName: 'bg-whatsapp',
              },
              {
                value: 'sms',
                label: 'SMS',
                icon: <Phone className="size-4" />,
                activeClassName: 'bg-brand',
              },
            ]}
          />

          {/* ─── Step rail ─── */}
          <ol className="flex items-center gap-1.5">
            {stepLabels.map((label, i) => {
              const active = step === i;
              const done = step > i;
              const reachable = canOpenStep(i);
              return (
                <li key={label} className="flex-1">
                  <button
                    type="button"
                    disabled={!reachable || alreadyUsed}
                    onClick={() => setStep(i)}
                    aria-current={active ? 'step' : undefined}
                    className={`flex w-full items-center gap-1.5 rounded-tap border px-2.5 py-2 text-[11px] font-semibold transition-colors ${
                      active
                        ? 'border-transparent bg-surface text-ink shadow-elev-1'
                        : done
                          ? 'border-transparent bg-brand-soft text-brand'
                          : 'border-line bg-surface text-muted'
                    } disabled:opacity-40`}
                  >
                    <span
                      className={`grid size-4 shrink-0 place-items-center rounded-full text-[9px] font-bold ${
                        active
                          ? 'bg-brand text-white'
                          : done
                            ? 'bg-brand-soft text-brand'
                            : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {done ? <Check size={9} /> : i + 1}
                    </span>
                    <span className="truncate">{label}</span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* ─── Step body ─── */}
          <div className="bg-white rounded-card border border-gray-100 p-3 sm:p-4">
            {channel === 'whatsapp' && step === 0 && (
              <>
                <StepTitle
                  title="Choose a card"
                  hint="Pick an approved card or upload your own, then drag the guest name onto it."
                />
                <ReminderCardDesigner
                  eventId={eventId!}
                  cardUrl={cardUrl}
                  design={design}
                  sampleName={sampleName}
                  onChange={({ cardUrl: url, design: d }) => {
                    setCardUrl(url);
                    setDesign(d);
                  }}
                />
              </>
            )}

            {channel === 'whatsapp' && step === 1 && mchangoEvent && (
              <>
                <StepTitle
                  title="Fill in the message"
                  hint="Every slot the WhatsApp template can personalise. The greeting is each guest's own name — pick who to preview. Anything you leave alone keeps the event's own details, and clearing a field leaves it out of the message."
                />
                <MchangoVariables
                  event={mchangoEvent}
                  overrides={mchangoOverrides}
                  onChange={setMchangoOverrides}
                  guests={remindableGuests.map((g) => ({ id: g.id, name: g.name, title: g.title }))}
                  previewGuestId={previewGuestId}
                  onPreviewGuestChange={setPreviewGuestId}
                  saving={savingVariables}
                />
              </>
            )}

            {channel === 'sms' && step === 0 && (
              <>
                <StepTitle
                  title="Write your reminder"
                  hint="Use {name} and {event} to personalise it. What you type is saved on this device, so it is here next time you come to send."
                />
                <textarea
                  rows={7}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Habari {name}, tunakumbusha kuhusu mchango wako kwa {event}. Asante."
                  className="w-full p-3 border border-gray-200 rounded-card text-[15px] focus:ring-2 focus:ring-brandring focus:border-transparent resize-none bg-gray-50/40"
                />
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => setMessage((m) => `${m} {name}`)}
                    className="text-[11px] font-semibold text-brand bg-brand/[0.07] rounded-lg px-2.5 py-1.5"
                  >
                    + {'{name}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMessage((m) => `${m} {event}`)}
                    className="text-[11px] font-semibold text-brand bg-brand/[0.07] rounded-lg px-2.5 py-1.5"
                  >
                    + {'{event}'}
                  </button>
                  <SmsCounter
                    text={message
                      .replace(/\{name\}/g, 'Mr John Doe')
                      .replace(/\{event\}/g, event?.name || 'the event')}
                    maxParts={bypassPayment ? null : MAX_SMS_PARTS_PER_GUEST}
                  />
                </div>
              </>
            )}

            {step === lastStep && (
              <>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-gray-900">Pick guests</h2>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {remindableGuests.length} guest{remindableGuests.length === 1 ? '' : 's'} · sending over{' '}
                      {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      disabled={alreadyUsed || remindableGuests.length === 0}
                      className="flex items-center gap-1.5 text-xs font-semibold text-brand disabled:opacity-40"
                    >
                      {selectedGuests.size === remindableGuests.length && remindableGuests.length > 0 ? (
                        <CheckSquare size={15} />
                      ) : (
                        <Square size={15} />
                      )}
                      {selectedGuests.size === remindableGuests.length && remindableGuests.length > 0
                        ? 'None'
                        : 'All'}
                    </button>
                    {channel === 'whatsapp' && cardUrl ? (
                      <ReminderCardPreview
                        eventId={eventId!}
                        guests={selected.map((g) => ({ id: g.id, name: g.name, title: g.title }))}
                        disabled={alreadyUsed}
                        disabledHint="Reminders have already been sent for this event."
                      />
                    ) : null}
                  </div>
                </div>

                <div className="relative mb-2">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search name or number"
                    className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-tap text-sm focus:bg-white focus:ring-2 focus:ring-brandring focus:border-transparent"
                  />
                </div>

                {remindableGuests.length === 0 ? (
                  <div className="text-center py-10">
                    <Users size={26} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No guests with a phone number yet.</p>
                  </div>
                ) : filteredGuests.length === 0 ? (
                  <div className="text-center py-10">
                    <Search size={24} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No guest matches “{search}”.</p>
                  </div>
                ) : (
                  <ul className="divide-y divide-gray-100 max-h-[52vh] overflow-y-auto -mx-3 sm:-mx-4 px-3 sm:px-4">
                    {filteredGuests.map((guest) => {
                      const on = selectedGuests.has(guest.id);
                      const free = guest.reminderCount < FREE_REMINDERS_PER_GUEST;
                      const isWhatsApp = guest.routingChannel === 'whatsapp';
                      return (
                        <li key={guest.id}>
                          <button
                            type="button"
                            onClick={() => toggleSelectGuest(guest.id)}
                            disabled={alreadyUsed}
                            className="w-full flex items-center gap-3 py-2.5 text-left active:bg-gray-50 disabled:opacity-50"
                          >
                            <span
                              className={`w-5 h-5 rounded-md grid place-items-center shrink-0 border transition ${
                                on ? 'bg-brand border-brand-200' : 'border-gray-300'
                              }`}
                            >
                              {on && <Check size={12} className="text-white" />}
                            </span>
                            <span className="w-8 h-8 rounded-full bg-brand/[0.08] text-brand grid place-items-center text-[11px] font-bold shrink-0">
                              {guest.name.trim().charAt(0).toUpperCase()}
                            </span>
                            <span className="flex-1 min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-gray-800 truncate">
                                  {guest.title ? `${guest.title} ${guest.name}` : guest.name}
                                </span>
                                {/* Shows how this guest is normally routed, like the
                                    SMS reminder screen. */}
                                <span
                                  className={`shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${
                                    isWhatsApp
                                      ? 'text-brand bg-[rgba(13,75,75,0.07)]'
                                      : 'text-gray-600 bg-gray-100'
                                  }`}
                                >
                                  {isWhatsApp ? <MessageCircle size={9} /> : <Phone size={9} />}
                                  {isWhatsApp ? 'WA' : 'SMS'}
                                </span>
                              </span>
                              <span className="block text-[11px] text-gray-400 truncate">{guest.phone}</span>
                            </span>
                            <span className="text-[10px] text-right shrink-0 flex flex-col items-end gap-0.5">
                              {free ? (
                                <span className="text-brand flex items-center gap-0.5 font-semibold">
                                  <Gift size={9} /> Free
                                </span>
                              ) : (
                                <span className="text-gray-500 font-semibold">{REMINDER_COST}</span>
                              )}
                              <span className="text-gray-400 flex items-center gap-0.5">
                                <Hash size={8} /> {guest.reminderCount}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {insufficientCredits && (
                  <div className="mt-3 bg-danger-soft border border-danger-border rounded-tap p-2.5 flex items-center gap-2">
                    <Info size={14} className="text-danger shrink-0" />
                    <p className="text-[11px] text-danger">
                      Need {totalCost} credits, you have {credits}.
                    </p>
                    <Link href="/client/billing" className="ml-auto text-[11px] font-semibold text-danger underline shrink-0">
                      Get credits
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      {/* ─── Sending overlay ─── */}
      {/* A send can run for minutes on a large guest list, so the tenant watches
          it advance instead of staring at a button that says "Sending". */}
      {sending && progress ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <div className="w-full max-w-sm rounded-card border border-line bg-surface p-5 shadow-elev-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`grid size-9 shrink-0 place-items-center rounded-full text-white ${
                  channel === 'whatsapp' ? 'bg-whatsapp' : 'bg-brand'
                }`}
              >
                {channel === 'whatsapp' ? (
                  <MessageCircle className="size-4" aria-hidden="true" />
                ) : (
                  <Phone className="size-4" aria-hidden="true" />
                )}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">
                  Sending {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} reminders
                </p>
                <p className="text-[11px] text-muted">
                  Keep this page open until it finishes.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-2xl font-bold leading-none text-ink tabular-nums">
                  {progress.processed}
                  <span className="text-base font-semibold text-muted">
                    /{progress.total}
                  </span>
                </p>
                <p className="text-[11px] font-semibold text-brand tabular-nums">
                  {progress.total > 0
                    ? Math.round((progress.processed / progress.total) * 100)
                    : 0}
                  %
                </p>
              </div>

              <AppProgressBar
                value={progress.processed}
                max={progress.total}
                tone={progress.failed > 0 ? 'warn' : 'brand'}
              />

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                <span className="flex items-center gap-1 font-semibold text-success">
                  <CircleCheck size={12} aria-hidden="true" /> {progress.sent} sent
                </span>
                {progress.failed > 0 ? (
                  <span className="flex items-center gap-1 font-semibold text-danger">
                    <CircleX size={12} aria-hidden="true" /> {progress.failed} failed
                  </span>
                ) : null}
                {progress.lastName ? (
                  <span className="min-w-0 flex-1 truncate text-right text-muted">
                    Last: {progress.lastName}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ─── Sticky action bar ─── */}
      {/* Sits above the mobile tab bar via --app-nav-h. */}
      <div className="fixed bottom-[var(--app-nav-h)] inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200">
        <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 py-2.5 flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="h-12 px-4 rounded-card border border-gray-200 text-gray-600 font-semibold text-sm flex items-center gap-1.5 active:scale-[0.98] transition shrink-0"
            >
              <ArrowRight size={15} className="rotate-180" /> Back
            </button>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400 leading-tight">
              {selectedGuests.size} guest{selectedGuests.size === 1 ? '' : 's'} selected
            </p>
            <p className="text-sm font-bold text-gray-900 leading-tight">
              {bypassPayment || totalCost === 0 ? 'Free' : `${totalCost} credits`}
            </p>
          </div>

          {step < lastStep ? (
            <button
              type="button"
              onClick={goNext}
              disabled={savingDesign || savingVariables || !canOpenStep(step + 1)}
              className="h-12 px-5 rounded-card bg-brand text-white font-semibold text-sm flex items-center gap-1.5 active:scale-[0.98] transition disabled:opacity-40 shadow-sm"
            >
              {savingDesign || savingVariables ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={15} className="sm:hidden" />
              )}
              Continue
              <ArrowRight size={15} className="hidden sm:block" />
            </button>
          ) : (
            <button
              type="button"
              onClick={sendReminders}
              disabled={sending || !canSend}
              className="h-12 px-5 rounded-card bg-brand text-white font-semibold text-sm flex items-center gap-1.5 active:scale-[0.98] transition disabled:opacity-40 shadow-sm"
            >
              {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {sending ? 'Sending' : 'Send'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-lg leading-tight text-ink">{title}</h2>
      {hint ? <p className="mt-1 text-[13px] leading-relaxed text-muted">{hint}</p> : null}
    </div>
  );
}
