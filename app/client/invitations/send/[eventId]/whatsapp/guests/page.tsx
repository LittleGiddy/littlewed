'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Search, CheckCircle2, RefreshCw, AlertTriangle, MessageCircle, Gauge, Inbox, ShieldCheck } from 'lucide-react';
import {
  SendGuest,
  SendResult,
  INVITE_TEMPLATES,
  getFullName,
  useGuestData,
  FlowSteps,
  FlowHeader,
  Card,
  LoadingState,
  SendProgressCard,
} from '../../../components/shared';

const DEFAULT_DAILY_LIMIT = 250;

export default function WhatsappGuestsPage() {
  const { eventId } = useParams();
  const id = Array.isArray(eventId) ? eventId[0] : eventId;
  const { event, loading, reload, whatsappPending, bypassPayment } = useGuestData(eventId);

  const [view, setView] = useState<'pending' | 'failed'>('pending');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [sendingTotal, setSendingTotal] = useState(0);
  const [failed, setFailed] = useState<SendResult[]>([]);
  const [dailyLimit, setDailyLimit] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem(`wa_daily_limit_${id}`) || '', 10);
      return saved > 0 ? saved : DEFAULT_DAILY_LIMIT;
    } catch {
      return DEFAULT_DAILY_LIMIT;
    }
  });
  const [waUsed, setWaUsed] = useState(0);

  // ─── Draft (template + vars) from the compose screen ─────────────────────
  const draft = useMemo(() => {
    if (!id) return null;
    try {
      const saved = localStorage.getItem(`whatsapp_draft_${id}`);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }, [id]);

  // ─── Daily limit: load current WhatsApp usage today ──────────────────────
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

  const limitReached = dailyLimit > 0 && waUsed >= dailyLimit;
  const tplName = draft && typeof draft.template === 'string' ? draft.template : 'mwalikoforth';
  const templateInfo = INVITE_TEMPLATES[tplName];

  const pendingPool = useMemo(() => whatsappPending.filter(g => !!g.passCode), [whatsappPending]);
  const cardless = useMemo(() => whatsappPending.filter(g => !g.passCode), [whatsappPending]);

  const filtered = useMemo(() => {
    const pool = view === 'pending' ? pendingPool : [];
    if (!query.trim()) return pool;
    const q = query.toLowerCase();
    return pool.filter(
      g => g.name.toLowerCase().includes(q) || (g.phone || '').includes(q) || (g.cardNumber || '').includes(q)
    );
  }, [view, pendingPool, query]);

  const selectableIds = useMemo(() => new Set(filtered.map(g => g.id)), [filtered]);
  const allSelected = filtered.length > 0 && filtered.every(g => selected.has(g.id));

  const toggle = (guestId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(guestId)) next.delete(guestId);
      else next.add(guestId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allSelected) selectableIds.forEach(gid => next.delete(gid));
      else selectableIds.forEach(gid => next.add(gid));
      return next;
    });
  };

  async function doSend(guestIds: string[]): Promise<SendResult[]> {
    if (guestIds.length === 0) return [];
    setSending(true);
    setSendingTotal(guestIds.length);
    toast.loading(`Sending ${guestIds.length} WhatsApp invitation${guestIds.length === 1 ? '' : 's'}…`, {
      id: 'send-invites-toast',
      duration: Infinity,
    });
    try {
      const res = await fetch('/api/invitations/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventId: id,
          guestIds,
          channel: 'whatsapp',
          forceChannel: 'whatsapp',
          whatsappTemplate: templateInfo?.whatsappName,
          whatsappContact: draft?.contact || '',
          eventType: draft?.eventType || 'harusi',
          whatsappVariables: draft?.vars || {},
          dailyLimit,
        }),
      });
      const data = await res.json();
      toast.dismiss('send-invites-toast');
      if (!res.ok) {
        toast.error(data.error || 'Send failed. Please try again.', { duration: 6000 });
        setSending(false);
        return [];
      }
      if (typeof data.waUsed === 'number') setWaUsed(data.waUsed);
      const failedResults = (data.results || []).filter(
        (r: SendResult) => !r.success && r.reason !== 'already_sent' && r.reason !== 'limit'
      );
      if (data.successCount > 0) {
        toast.success(
          `Sent ${data.successCount} WhatsApp invitation${data.successCount === 1 ? '' : 's'}`,
          { duration: 5000 }
        );
      }
      if (data.waLimitReached) {
        toast.error(`WhatsApp daily limit of ${data.waLimit} reached for today.`, { duration: 8000 });
      }
      return failedResults;
    } catch {
      toast.dismiss('send-invites-toast');
      toast.error('Network error. Please try again.', { duration: 6000 });
      return [];
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    if (selected.size === 0 || sending || limitReached) return;
    const result = await doSend([...selected]);
    setFailed(result);
    setSelected(new Set());
    if (result.length > 0) {
      toast.error(`${result.length} invitation${result.length === 1 ? '' : 's'} need attention`, {
        duration: 8000,
      });
      setView('failed');
    }
    await reload();
  }

  async function handleRetryAll() {
    if (failed.length === 0 || sending || limitReached) return;
    const result = await doSend(failed.map(f => f.guestId));
    setFailed(result);
    if (result.length === 0) {
      toast.success('All failed invitations were sent');
      setView('pending');
    }
    await reload();
  }

  if (loading) return <LoadingState label="Loading guests..." />;

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <FlowHeader backUrl={`/client/invitations/send/${id}/whatsapp`} title="Choose guests" subtitle={event?.name} />
      <FlowSteps current={3} />

      {/* ─── Daily limit bar ─── */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#25D366]/10 text-[#15803d] flex items-center justify-center">
              <Gauge size={17} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">WhatsApp daily limit</p>
              <p className="text-xs text-gray-500">
                {waUsed} sent today · limit {dailyLimit}
              </p>
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-gray-500">
            edit
            <input
              type="number"
              min={1}
              value={dailyLimit}
              onChange={e => {
                const v = parseInt(e.target.value || '0', 10);
                setDailyLimit(v > 0 ? v : 0);
                try {
                  localStorage.setItem(`wa_daily_limit_${id}`, String(v));
                } catch {
                  // ignore
                }
              }}
              className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs bg-white"
            />
          </label>
        </div>
        <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${limitReached ? 'bg-amber-500' : 'bg-[#25D366]'}`}
            style={{ width: `${Math.min(100, (waUsed / dailyLimit) * 100)}%` }}
          />
        </div>
        {limitReached && (
          <p className="mt-2 text-[11px] font-medium text-amber-700">
            Daily limit reached. WhatsApp sends are paused — try again tomorrow, or send the reminder via SMS instead.
          </p>
        )}
      </Card>

      {/* ─── Summary + action ─── */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">Sending via</p>
            <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
              <MessageCircle size={14} className="text-[#15803d]" /> WhatsApp · {templateInfo?.displayName} ·{' '}
              {selected.size} selected
            </p>
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={selected.size === 0 || sending || limitReached}
            className="px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-semibold text-sm hover:bg-[#1db356] transition disabled:opacity-40 flex items-center gap-2"
          >
            {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </Card>

      {sending && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-4">
          <SendProgressCard
            total={sendingTotal}
            channel="whatsapp"
            note={limitReached ? `WhatsApp is capped at ${dailyLimit} per day — anyone past the cap stays in "To send" for tomorrow.` : undefined}
          />
        </motion.div>
      )}

      {/* ─── View toggle ─── */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1 mb-4 w-max">
        <button
          type="button"
          onClick={() => setView('pending')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
            view === 'pending' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'
          }`}
        >
          To send {pendingPool.length}
        </button>
        <button
          type="button"
          onClick={() => setView('failed')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition flex items-center gap-1.5 ${
            view === 'failed' ? 'bg-amber-500/15 text-amber-700' : 'text-gray-500'
          }`}
        >
          <AlertTriangle size={12} className={view === 'failed' ? 'text-amber-600' : ''} />
          Retry {failed.length}
        </button>
      </div>

      {view === 'failed' ? (
        <AnimatePresence mode="wait">
          <motion.div
            key="failed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {failed.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 px-6 py-10 text-center">
                <CheckCircle2 size={30} className="text-[#1A7A4A] mx-auto mb-3" />
                <p className="font-semibold text-gray-900">Everything went through</p>
                <p className="text-sm text-gray-500 mt-1">No failed WhatsApp sends. You&apos;re all caught up.</p>
                <div className="mt-5 text-sm font-semibold text-[#0D4B4B]">
                  <Link href={`/client/invitations/sent/${id}`} className="hover:underline">
                    View sent invitations →
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-amber-800">
                    {failed.length} guest{failed.length === 1 ? '' : 's'} didn&apos;t get their WhatsApp invitation
                    yet.
                  </p>
                  <button
                    type="button"
                    onClick={handleRetryAll}
                    disabled={sending || limitReached}
                    className="flex-shrink-0 px-3.5 py-1.5 bg-amber-700 text-white rounded-lg text-xs font-semibold hover:bg-amber-800 transition disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {sending ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    {limitReached ? 'Limit reached' : 'Resend all'}
                  </button>
                </div>
                <div className="space-y-2">
                  {failed.map(f => {
                    const guest = whatsappPending.find(g => g.id === f.guestId);
                    if (!guest) return null;
                    return (
                      <div key={f.guestId} className="bg-white rounded-2xl border border-gray-200 p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {getFullName(guest).slice(0, 1)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm truncate">{getFullName(guest)}</p>
                            <p className="text-xs text-gray-500 truncate">{guest.phone}</p>
                            <p className="text-[11px] text-amber-700 mt-0.5">{f.error || 'Send failed'}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (limitReached && !sending) return toast.error('WhatsApp daily limit reached');
                              doSend([guest.id]).then(r => {
                                setFailed(prev => {
                                  const without = prev.filter(x => x.guestId !== guest.id);
                                  const stillFailed = r.filter(x => x.guestId === guest.id);
                                  return [...without, ...stillFailed];
                                });
                                reload();
                              });
                            }}
                            disabled={sending}
                            className="flex-shrink-0 w-9 h-9 rounded-full bg-[#25D366] text-white flex items-center justify-center hover:bg-[#1db356] transition disabled:opacity-40"
                            title="Retry this guest"
                          >
                            <RefreshCw size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* ─── Cap reached: friendly "come back tomorrow" card ─── */}
            {limitReached && pendingPool.length > 0 && (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
                <Gauge size={16} className="text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-800">Today&apos;s WhatsApp cap is reached</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed">
                    You&apos;ve used {waUsed} of {dailyLimit} WhatsApp sends today. The {pendingPool.length} remaining
                    guests are saved and will stay in &quot;To send&quot; — just come back tomorrow and send the rest,
                    or switch to SMS anytime.
                  </p>
                </div>
              </div>
            )}

            {/* ─── Plan transparency note ─── */}
            {!bypassPayment && pendingPool.length > 0 && !limitReached && (
              <div className="mb-4 rounded-2xl border border-[#0D4B4B]/10 bg-[#0D4B4B]/[0.03] px-4 py-3 flex items-start gap-2.5">
                <ShieldCheck size={15} className="text-[#0D4B4B] flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-gray-600 leading-relaxed">
                  One WhatsApp per guest on your plan — guests who already received theirs won&apos;t appear here, and
                  only failed ones stay for retry, so nobody is ever messaged twice by accident.
                </p>
              </div>
            )}

            {pendingPool.length > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search guests..."
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent"
                  />
                </div>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs font-semibold text-[#15803d] flex-shrink-0"
                >
                  {allSelected ? 'Clear' : 'Select all'}
                </button>
              </div>
            )}

            {pendingPool.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 px-6 py-10 text-center">
                <Inbox size={30} className="text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-gray-900">All WhatsApp invitations are sent</p>
                <p className="text-sm text-gray-500 mt-1">Every guest with a card already received their WhatsApp.</p>
                <div className="mt-5 text-sm font-semibold text-[#0D4B4B]">
                  <Link href={`/client/invitations/sent/${id}`} className="hover:underline">
                    View sent invitations →
                  </Link>
                </div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 px-6 py-10 text-center">
                <Search size={26} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-600">No guests match &quot;{query}&quot;</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((guest: SendGuest, idx: number) => (
                  <motion.div
                    key={guest.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    className="bg-white rounded-2xl border border-gray-200 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggle(guest.id)}
                        aria-label={`Select ${getFullName(guest)}`}
                        className={`w-6 h-6 rounded-lg border-2 shrink-0 grid place-items-center transition ${
                          selected.has(guest.id)
                            ? 'bg-[#25D366] border-[#25D366] text-white'
                            : 'border-gray-300 text-transparent'
                        }`}
                      >
                        ✓
                      </button>
                      <div className="w-10 h-10 rounded-full bg-[#25D366]/10 text-[#15803d] flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {getFullName(guest).slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{getFullName(guest)}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {guest.phone} · Card {guest.cardNumber || '—'}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {cardless.length > 0 && view === 'pending' && (
              <div className="mt-4 bg-white rounded-2xl border border-dashed border-gray-300 px-4 py-3 flex items-start gap-3">
                <Inbox size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-gray-700">
                    {cardless.length} guest{cardless.length === 1 ? '' : 's'} on hold
                  </p>
                  <p className="text-[11px] text-gray-500">
                    These guests don&apos;t have a card generated yet, so they can&apos;t be sent until the card
                    design is finalised. They&apos;ll appear here again automatically once ready.
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}