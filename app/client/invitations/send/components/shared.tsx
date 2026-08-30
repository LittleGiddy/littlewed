'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Phone, MessageCircle, CheckCircle2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────

export interface SendGuest {
  id: string;
  name: string;
  title?: string | null;
  phone: string | null;
  routingChannel: string;
  guestType?: string | null;
  cardNumber?: string | null;
  passCode?: string | null;
  invitationCard?: string | null;
  invitationSentAt?: string | null;
  smsSentAt?: string | null;
  whatsappSentAt?: string | null;
  lastSendStatus?: string | null;
  lastSendError?: string | null;
  checkedIn?: boolean;
}

export interface SendResult {
  guestId: string;
  name: string;
  success: boolean;
  skipped?: boolean;
  reason?: string;
  error?: string;
  channel?: string;
}

// ─── SMS: exactly 3 per-guest variables (Guest Name, Card No, Card Type) ─

export const SMS_VARIABLES = [
  { key: '{guestName}', label: 'Guest Name', example: 'Mr John Doe' },
  { key: '{cardNumber}', label: 'Card Number', example: '00123' },
  { key: '{cardType}', label: 'Card Type', example: 'Single / Double' },
] as const;

export const DEFAULT_SMS_TEMPLATE = `Habari {guestName},

Karibu! Hii ni kadi yako ya mwaliko.

Card No: {cardNumber}
Aina: {cardType}

Tafadhali onyesha kadi hii wakati wa kuingia.
Ahsante!`;

// ─── WhatsApp-only approved templates ──────────────────────────────────────

export const INVITE_TEMPLATES: Record<
  string,
  { displayName: string; whatsappName: string; hasContact: boolean; hasEventType: boolean }
> = {
  mwaliko: { displayName: 'Template 1', whatsappName: 'Mwalikotemp', hasContact: false, hasEventType: false },
  mwalikosecond: { displayName: 'Template 2', whatsappName: 'Mwalikosecond', hasContact: true, hasEventType: false },
  mwalikoforth: { displayName: 'Template 3', whatsappName: 'MwalikoForth', hasContact: true, hasEventType: true },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

export function getFullName(g: SendGuest): string {
  return g.title ? `${g.title} ${g.name}`.trim() : g.name;
}

export function cardTypeLabel(g: { guestType?: string | null }): string {
  return g.guestType === 'DOUBLE' ? 'Double' : 'Single';
}

export function buildSmsMessage(template: string, guest: SendGuest): string {
  const fullName = getFullName(guest);
  const cardNumber = guest.cardNumber || '';
  const cardType = cardTypeLabel(guest);
  const varsMap: Record<string, string> = {
    guestName: fullName,
    name: fullName,
    fullName,
    cardNumber,
    cardNo: cardNumber,
    guestType: cardType,
    cardType,
  };
  return template.replace(/\{([^}]+)\}/g, (match: string, key: string) => varsMap[key] ?? match);
}

export const SAMPLE_GUEST: SendGuest = {
  id: 'sample',
  name: 'John Doe',
  title: 'Mr',
  phone: '+255712345678',
  routingChannel: 'sms',
  cardNumber: '00123',
  passCode: 'WED-8F92',
  guestType: 'DOUBLE',
  invitationSentAt: null,
  smsSentAt: null,
  whatsappSentAt: null,
};

// ─── Persisted SMS draft (compose screen ↔ guests screen) ───────────────────

export function readSmsTemplateDraft(eventId?: string): string {
  if (!eventId) return DEFAULT_SMS_TEMPLATE;
  try {
    const saved = localStorage.getItem(`sms_template_${eventId}`);
    if (saved) {
      const state = JSON.parse(saved);
      if (typeof state.template === 'string' && state.template.trim()) {
        return state.template;
      }
    }
  } catch {
    // ignore
  }
  return DEFAULT_SMS_TEMPLATE;
}

// ─── Data hook: event + guests + bypass flag ────────────────────────────────

export function useGuestData(eventId: string | string[] | undefined) {
  const id = Array.isArray(eventId) ? eventId[0] : eventId;
  const [event, setEvent] = useState<{
    id: string;
    name: string;
    date?: string;
    venue?: string;
    hostFamily?: string;
    person1?: string;
    person2?: string;
    time?: string;
    testMode?: boolean;
  } | null>(null);
  const [guests, setGuests] = useState<SendGuest[]>([]);
  const [bypassPayment, setBypassPayment] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return { event: null as typeof event, bypass: false, guests: [] as SendGuest[] };
    const [eventRes, guestsRes] = await Promise.all([
      fetch(`/api/events/${id}`, { credentials: 'include' }),
      fetch(`/api/events/${id}/guests`, { credentials: 'include' }),
    ]);
    const eventData = await eventRes.json();
    const eventObj = eventData.event || eventData;
    let guests: SendGuest[] = [];
    try {
      const guestsData = await guestsRes.json();
      if (Array.isArray(guestsData)) guests = guestsData;
    } catch {
      // ignore
    }
    return {
      event: eventObj && eventObj.id ? eventObj : null,
      bypass: !!eventData.bypassPayment || !!eventObj?.bypassPayment,
      guests,
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let ignore = false;
    fetchData()
      .then(data => {
        if (ignore) return;
        setEvent(data.event);
        setBypassPayment(data.bypass);
        setGuests(data.guests);
        setLoading(false);
      })
      .catch(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [id, fetchData]);

  const reload = useCallback(async () => {
    const data = await fetchData();
    setEvent(data.event);
    setBypassPayment(data.bypass);
    setGuests(data.guests);
    setLoading(false);
  }, [fetchData]);

  const smsPending = guests.filter(g => g.phone && !g.smsSentAt);
  const whatsappPending = guests.filter(g => g.phone && !g.whatsappSentAt);
  const smsSent = guests.filter(g => g.smsSentAt);
  const whatsappSent = guests.filter(g => g.whatsappSentAt);
  const missingCards = guests.filter(g => !g.passCode);

  return {
    eventId: id,
    event,
    guests,
    bypassPayment,
    loading,
    reload,
    smsPending,
    whatsappPending,
    smsSent,
    whatsappSent,
    missingCards,
  };
}

// ─── iOS-style step indicator ───────────────────────────────────────────────

export const FLOW_STEPS = [
  { label: 'Channel', short: '1' },
  { label: 'Message', short: '2' },
  { label: 'Guests', short: '3' },
];

export function FlowSteps({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-2 mb-5 w-full max-w-md mx-auto">
      {FLOW_STEPS.map((s, i) => {
        const stepNum = i + 1;
        const isDone = stepNum < current;
        const isActive = stepNum === current;
        return (
          <div key={s.label} className="flex items-center gap-2 flex-1">
            <div className="flex flex-col items-center gap-1 flex-1">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  isDone
                    ? 'bg-[#1A7A4A] text-white'
                    : isActive
                      ? 'bg-[#0D4B4B] text-white ring-4 ring-[#0D4B4B]/10'
                      : 'bg-gray-100 text-gray-400'
                }`}
              >
                {isDone ? <CheckCircle2 size={14} /> : s.short}
              </div>
              <span className={`text-[10px] font-semibold ${isActive ? 'text-gray-800' : 'text-gray-400'}`}>
                {s.label}
              </span>
            </div>
            {stepNum < FLOW_STEPS.length && (
              <div className={`h-px flex-1 mb-4 ${isDone ? 'bg-[#1A7A4A]/40' : 'bg-gray-100'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Screen header with back button ─────────────────────────────────────────

export function FlowHeader({
  backUrl,
  title,
  subtitle,
}: {
  backUrl: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <Link
        href={backUrl}
        className="flex-shrink-0 w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:text-[#0D4B4B] hover:border-[#0D4B4B] transition"
      >
        <ArrowLeft size={17} />
      </Link>
      <div className="min-w-0">
        <h1 className="font-serif text-xl sm:text-2xl font-black text-gray-900 truncate leading-tight">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-gray-500 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Variable chip (tap to insert) ──────────────────────────────────────────

export function VariableChip({ variable, onInsert }: { variable: { key: string; label: string; example: string }; onInsert: () => void }) {
  return (
    <button
      type="button"
      onClick={onInsert}
      className="flex items-center gap-1.5 text-[11px] bg-white border border-[#0D4B4B]/20 px-2.5 py-1.5 rounded-full hover:border-[#0D4B4B] hover:bg-[#0D4B4B]/5 transition"
      title={`${variable.label}: ${variable.example}`}
    >
      <code className="text-[#0D4B4B] font-mono font-semibold">{variable.key}</code>
      <span className="text-gray-400 text-[9px]">+</span>
    </button>
  );
}

// ─── Whitespace-friendly card (used for iOS-like grouping) ───────────────────

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

// ─── Loading spinner ─────────────────────────────────────────────────────────

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
      <Loader2 size={28} className="animate-spin text-[#0D4B4B]" />
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

// ─── Channel badges ──────────────────────────────────────────────────────────

export function ChannelBadge({ channel }: { channel: string }) {
  if (channel === 'whatsapp') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1da851] bg-[#1da851]/10 px-2 py-0.5 rounded-full">
        <MessageCircle size={11} /> WhatsApp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
      <Phone size={11} /> SMS
    </span>
  );
}

// ─── "Needs cards generated" banner ──────────────────────────────────────────

export function NeedCardsBanner({ count }: { count: number }) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold flex-shrink-0">
        {count}
      </div>
      <div>
        <p className="text-sm font-semibold text-amber-800">Cards not generated yet</p>
        <p className="text-xs text-amber-700">
          {count} guest{count === 1 ? '' : 's'} need a pass-code card before their invitation can be sent. Missing
          cards are generated automatically when you send — just make sure the card design is final first.
        </p>
      </div>
    </div>
  );
}