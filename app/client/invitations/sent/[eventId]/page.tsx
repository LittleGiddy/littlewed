'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { RefreshCw, Phone, MessageCircle, CheckCircle2, Lock, Copy, Check } from 'lucide-react';
import {
  SendGuest,
  SendResult,
  INVITE_TEMPLATES,
  getFullName,
  readSmsTemplateDraft,
  useGuestData,
  FlowSteps,
  FlowHeader,
  Card,
  LoadingState,
} from '../../send/components/shared';

function formatDate(value?: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function readWhatsappDraftObject(eventId?: string): {
  template?: string;
  vars?: Record<string, string>;
  contact?: string;
  eventType?: string;
} | null {
  if (!eventId) return null;
  try {
    const raw = localStorage.getItem(`whatsapp_draft_${eventId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.template === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export default function SentInvitationsPage() {
  const { eventId } = useParams();
  const id = Array.isArray(eventId) ? eventId[0] : eventId;
  const { event, loading, reload, smsSent, whatsappSent, bypassPayment } = useGuestData(eventId);

  const [tab, setTab] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [waUsed, setWaUsed] = useState(0);
  const [waLimit] = useState(() => {
    if (!id) return 250;
    try {
      const saved = parseInt(localStorage.getItem(`wa_daily_limit_${id}`) || '', 10);
      return saved > 0 ? saved : 250;
    } catch {
      return 250;
    }
  });

  // ─── Load today's WhatsApp usage (only used for the Resend-all cap) ─────
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/invitations/usage/whatsapp?eventId=${id}`, { credentials: 'include' });
        const data = await res.json();
        if (typeof data.count === 'number') setWaUsed(data.count);
      } catch {
        // ignore
      }
    })();
  }, [id]);

  const list = useMemo(() => (tab === 'whatsapp' ? whatsappSent : smsSent), [tab, whatsappSent, smsSent]);

  async function handleResend(guest: SendGuest, channel: 'whatsapp' | 'sms') {
    setSendingId(guest.id);
    try {
      const route = channel === 'whatsapp' ? '/api/invitations/send-whatsapp' : '/api/invitations/send-sms';
      const body: Record<string, unknown> = { guestId: guest.id, eventId: id };
      if (channel === 'sms') body.message = readSmsTemplateDraft(id);
      const res = await fetch(route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`Resent to ${getFullName(guest)} via ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}`, {
          duration: 4500,
        });
        await reload();
      } else {
        toast.error(data.error || 'Resend failed', { duration: 6000 });
      }
    } catch {
      toast.error('Network error. Please try again.', { duration: 6000 });
    } finally {
      setSendingId(null);
    }
  }

  async function handleResendAll() {
    if (!bypassPayment || list.length === 0 || sendingAll) return;
    const ids = list.map(g => g.id);
    setSendingAll(true);
    toast.loading(`Resending ${ids.length} ${tab === 'whatsapp' ? 'WhatsApp' : 'SMS'} invitation${ids.length === 1 ? '' : 's'}…`, {
      id: 'resend-all-toast',
      duration: Infinity,
    });
    try {
      const body: Record<string, unknown> = { eventId: id, guestIds: ids, forceChannel: tab };
      if (tab === 'sms') {
        body.smsTemplate = readSmsTemplateDraft(id);
      } else {
        const draft = readWhatsappDraftObject(id);
        const tpl = draft?.template && INVITE_TEMPLATES[draft.template] ? INVITE_TEMPLATES[draft.template] : null;
        body.whatsappTemplate = tpl ? tpl.whatsappName : undefined;
        body.whatsappContact = draft?.contact || '';
        body.eventType = draft?.eventType || 'harusi';
        body.whatsappVariables = draft?.vars || {};
        body.dailyLimit = waLimit;
      }
      const res = await fetch('/api/invitations/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json();
      toast.dismiss('resend-all-toast');
      if (!res.ok) {
        toast.error(data.error || 'Resend failed. Please try again.', { duration: 6000 });
        setSendingAll(false);
        return;
      }
      if (data.successCount > 0) {
        toast.success(
          `Resent ${data.successCount} ${tab === 'whatsapp' ? 'WhatsApp' : 'SMS'} invitation${data.successCount === 1 ? '' : 's'}`,
          { duration: 5000 }
        );
      }
      const stillFailed: SendResult[] = (data.results || []).filter(
        (r: SendResult) => !r.success && r.reason !== 'already_sent'
      );
      if (stillFailed.length > 0) {
        const names = stillFailed.slice(0, 3).map(r => r.name).join(', ');
        toast.error(`${stillFailed.length} could not be sent${names ? `: ${names}${stillFailed.length > 3 ? '…' : ''}` : ''}`, {
          duration: 8000,
        });
      }
      if (data.waLimitReached) {
        toast.error(`WhatsApp daily limit of ${data.waLimit} reached for today.`, { duration: 8000 });
      }
      if (typeof data.waUsed === 'number') setWaUsed(data.waUsed);
      await reload();
    } catch {
      toast.dismiss('resend-all-toast');
      toast.error('Network error. Please try again.', { duration: 6000 });
    } finally {
      setSendingAll(false);
    }
  }

  async function copyCard(guest: SendGuest) {
    const text = `${getFullName(guest)}\nCard: ${guest.cardNumber || ''}\nCode: ${guest.passCode || ''}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(guest.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error('Could not copy', { duration: 3000 });
    }
  }

  if (loading) return <LoadingState label="Loading sent invitations..." />;

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <FlowHeader backUrl={`/client/invitations/send/${id}`} title="Sent invitations" subtitle={event?.name} />
      <FlowSteps current={3} />

      {/* ─── Stats ─── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">WhatsApp</p>
            <MessageCircle size={15} className="text-[#25D366]" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{whatsappSent.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">SMS</p>
            <Phone size={15} className="text-gray-500" />
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-1">{smsSent.length}</p>
        </Card>
      </div>

      {!bypassPayment && (
        <div className="mb-5 flex items-start gap-2.5 rounded-2xl border border-[#0D4B4B]/10 bg-[#0D4B4B]/[0.03] px-4 py-3">
          <Lock size={15} className="text-[#0D4B4B] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-600 leading-relaxed">
            <span className="font-semibold text-gray-800">Your plan: one invitation per guest per channel.</span>{' '}
            Guests who already received a message can&apos;t be re-sent from here. To retry a failed send, go back to
            the channel&apos;s send screen — only the failed ones are listed there.
          </p>
        </div>
      )}

      {/* ─── Channel tabs + Resend all ─── */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 w-max">
          <button
            type="button"
            onClick={() => setTab('whatsapp')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
              tab === 'whatsapp' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            <MessageCircle size={12} className="text-[#15803d]" /> WhatsApp · {whatsappSent.length}
          </button>
          <button
            type="button"
            onClick={() => setTab('sms')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
              tab === 'sms' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
            }`}
          >
            <Phone size={12} className="text-gray-500" /> SMS · {smsSent.length}
          </button>
        </div>
        {bypassPayment && list.length > 0 && (
          <button
            type="button"
            onClick={handleResendAll}
            disabled={sendingAll}
            className="flex-shrink-0 px-3.5 py-2 bg-[#0D4B4B] text-white rounded-xl text-xs font-semibold hover:bg-[#0A3939] transition disabled:opacity-40 flex items-center gap-1.5"
          >
            <RefreshCw size={13} className={sendingAll ? 'animate-spin' : ''} />
            {sendingAll ? 'Resending…' : 'Resend all'}
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 px-6 py-10 text-center">
          <CheckCircle2 size={30} className="text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-900">No {tab} invitations sent yet</p>
          <p className="text-sm text-gray-500 mt-1">
            <Link href={`/client/invitations/send/${id}/${tab}`} className="text-[#0D4B4B] font-semibold hover:underline">
              Go send some →
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(guest => (
            <div key={guest.id} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#0D4B4B]/10 text-[#0D4B4B] flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {getFullName(guest).slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{getFullName(guest)}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {guest.phone} · Card {guest.cardNumber || '—'} ·{' '}
                    {tab === 'whatsapp' ? formatDate(guest.whatsappSentAt) : formatDate(guest.smsSentAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => copyCard(guest)}
                  className="flex-shrink-0 w-9 h-9 rounded-xl border border-gray-200 text-gray-500 flex items-center justify-center hover:text-[#0D4B4B] hover:border-[#0D4B4B] transition"
                  title="Copy card details"
                >
                  {copiedId === guest.id ? <Check size={15} className="text-[#1A7A4A]" /> : <Copy size={15} />}
                </button>
                {bypassPayment ? (
                  <button
                    type="button"
                    onClick={() => handleResend(guest, tab)}
                    disabled={sendingId === guest.id}
                    className="flex-shrink-0 w-9 h-9 rounded-xl bg-[#0D4B4B] text-white flex items-center justify-center hover:bg-[#0A3939] transition disabled:opacity-40"
                    title="Resend invitation"
                  >
                    <RefreshCw size={15} className={sendingId === guest.id ? 'animate-spin' : ''} />
                  </button>
                ) : (
                  <span
                    className="flex-shrink-0 w-9 h-9 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center"
                    title="One invitation per guest per channel on your plan"
                  >
                    <Lock size={14} />
                  </span>
                )}
              </div>
              {guest.lastSendStatus === 'FAILED' && (
                <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                  Last send failed: {guest.lastSendError || 'unknown error'} · sent:{' '}
                  {tab === 'whatsapp' ? formatDate(guest.whatsappSentAt) : formatDate(guest.smsSentAt)}
                </p>
              )}
              {!bypassPayment && (
                <p className="mt-2 text-[10px] text-gray-400">
                  Invitation already delivered — resend is locked on your plan to avoid duplicates.
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {bypassPayment && (
        <div className="mt-5 rounded-2xl bg-[#0D4B4B]/[0.04] border border-[#0D4B4B]/10 px-4 py-3">
          <p className="text-[11px] text-gray-600 text-center leading-relaxed">
            You&apos;re on <span className="font-semibold text-[#0D4B4B]">unlimited-resend mode</span>, so you can
            resend any guest (individually or all at once).{tab === 'whatsapp' ? ` Today: ${waUsed} of ${waLimit} WhatsApp sends used.` : ''}
          </p>
        </div>
      )}
    </div>
  );
}