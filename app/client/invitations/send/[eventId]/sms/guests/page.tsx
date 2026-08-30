'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Search, CheckCircle2, RefreshCw, AlertTriangle, Phone, Inbox, Users } from 'lucide-react';
import {
  SendGuest,
  SendResult,
  getFullName,
  cardTypeLabel,
  readSmsTemplateDraft,
  useGuestData,
  FlowSteps,
  FlowHeader,
  Card,
  LoadingState,
  NeedCardsBanner,
} from '../../../components/shared';

export default function SmsGuestsPage() {
  const { eventId } = useParams();
  const id = Array.isArray(eventId) ? eventId[0] : eventId;
  const { event, loading, reload, smsPending, missingCards } = useGuestData(eventId);

  const [view, setView] = useState<'pending' | 'failed'>('pending');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState<SendResult[]>([]);

  const smsTemplate = useMemo(() => readSmsTemplateDraft(id), [id]);

  const pendingPool = useMemo(() => smsPending.filter(g => !!g.passCode), [smsPending]);
  const cardless = useMemo(() => smsPending.filter(g => !g.passCode), [smsPending]);

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
    setSending(true);
    try {
      const res = await fetch('/api/invitations/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          eventId: id,
          guestIds,
          smsTemplate,
          forceChannel: 'sms',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Send failed. Please try again.');
        setSending(false);
        return [];
      }
      const failedResults = (data.results || []).filter(
        (r: SendResult) => !r.success && r.reason !== 'already_sent'
      );
      if (data.successCount > 0) {
        toast.success(`Sent ${data.successCount} SMS invitation${data.successCount === 1 ? '' : 's'}`);
      }
      return failedResults;
    } catch {
      toast.error('Network error. Please try again.');
      return [];
    } finally {
      setSending(false);
    }
  }

  async function handleSend() {
    if (selected.size === 0 || sending) return;
    const result = await doSend([...selected]);
    setFailed(result);
    setSelected(new Set());
    if (result.length > 0) {
      toast.error(`${result.length} invitation${result.length === 1 ? '' : 's'} need attention`);
      setView('failed');
    }
    await reload();
  }

  async function handleRetryAll() {
    if (failed.length === 0 || sending) return;
    const result = await doSend(failed.map(f => f.guestId));
    setFailed(result);
    if (result.length === 0) {
      toast.success('All failed invitations were sent');
      setView('pending');
    }
    await reload();
  }

  async function handleRetryOne(guest: SendGuest) {
    if (sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/invitations/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ guestId: guest.id, eventId: id, message: smsTemplate }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(`${getFullName(guest)} · SMS sent`);
        setFailed(prev => prev.filter(f => f.guestId !== guest.id));
      } else {
        toast.error(data.error || 'Retry failed');
        setFailed(prev => prev.map(f => (f.guestId === guest.id ? { ...f, error: data.error || f.error } : f)));
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setSending(false);
      await reload();
    }
  }

  if (loading) return <LoadingState label="Loading guests..." />;

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <FlowHeader backUrl={`/client/invitations/send/${id}/sms`} title="Choose guests" subtitle={event?.name} />
      <FlowSteps current={3} />

      {/* ─── Summary + action ─── */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">Sending via</p>
            <p className="font-semibold text-gray-900 text-sm flex items-center gap-1.5">
              <Phone size={14} className="text-gray-600" /> SMS · {selected.size} selected
            </p>
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={selected.size === 0 || sending}
            className="px-5 py-2.5 bg-[#0D4B4B] text-white rounded-xl font-semibold text-sm hover:bg-[#0A3939] transition disabled:opacity-40 flex items-center gap-2"
          >
            {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 rounded-xl bg-[#0D4B4B]/5 px-4 py-2.5 text-xs text-[#0D4B4B]"
          >
            Sending {selected.size} invitations with short pauses between messages. Please keep this screen open — it
            takes a moment.
          </motion.div>
        )}
      </Card>

      {missingCards.length > 0 && (
        <div className="mb-4">
          <NeedCardsBanner count={missingCards.length} />
        </div>
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
                <p className="text-sm text-gray-500 mt-1">No failed SMS. You&apos;re all caught up.</p>
                <div className="flex items-center justify-center gap-3 mt-5 text-sm font-semibold text-[#0D4B4B]">
                  <Link href={`/client/invitations/sent/${id}`} className="hover:underline">
                    View sent invitations →
                  </Link>
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-amber-800">
                    {failed.length} guest{failed.length === 1 ? '' : 's'} didn&apos;t get their SMS yet.
                  </p>
                  <button
                    type="button"
                    onClick={handleRetryAll}
                    disabled={sending}
                    className="flex-shrink-0 px-3.5 py-1.5 bg-amber-700 text-white rounded-lg text-xs font-semibold hover:bg-amber-800 transition disabled:opacity-40 flex items-center gap-1.5"
                  >
                    {sending ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Retry all
                  </button>
                </div>
                <div className="space-y-2">
                  {failed.map(f => {
                    const guest = smsPending.find(g => g.id === f.guestId);
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
                            onClick={() => handleRetryOne(guest)}
                            disabled={sending}
                            className="flex-shrink-0 w-9 h-9 rounded-full bg-[#0D4B4B] text-white flex items-center justify-center hover:bg-[#0A3939] transition disabled:opacity-40"
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
            {/* ─── Search + select all ─── */}
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
                  className="text-xs font-semibold text-[#0D4B4B] flex-shrink-0"
                >
                  {allSelected ? 'Clear' : 'Select all'}
                </button>
              </div>
            )}

            {pendingPool.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 px-6 py-10 text-center">
                <Inbox size={30} className="text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-gray-900">All SMS invitations are sent</p>
                <p className="text-sm text-gray-500 mt-1">Every guest with a card already received their SMS.</p>
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
                            ? 'bg-[#0D4B4B] border-[#0D4B4B] text-white'
                            : 'border-gray-300 text-transparent'
                        }`}
                      >
                        ✓
                      </button>
                      <div className="w-10 h-10 rounded-full bg-[#0D4B4B]/10 text-[#0D4B4B] flex items-center justify-center font-bold text-sm flex-shrink-0">
                        {getFullName(guest).slice(0, 1)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{getFullName(guest)}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {guest.phone} · Card {guest.cardNumber || '—'} · {cardTypeLabel(guest)}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {cardless.length > 0 && view === 'pending' && (
              <div className="mt-4 bg-white rounded-2xl border border-dashed border-gray-300 px-4 py-3 flex items-start gap-3">
                <Users size={16} className="text-gray-400 flex-shrink-0 mt-0.5" />
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