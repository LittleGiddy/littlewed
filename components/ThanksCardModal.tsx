'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  X, Heart, MessageCircle, Phone, Upload, Image as ImageIcon,
  Loader2, Send, CheckCircle2, Info, Undo2, PartyPopper, BadgeCheck, Lock,
} from 'lucide-react';
import { confirmToast } from '@/lib/confirmToast';

interface CheckedGuest {
  id: string;
  name: string;
  checkedIn?: boolean;
  title?: string | null;
  phone?: string | null;
  routingChannel: string;
  guestType?: string | null;
  cardNumber?: string | null;
  thanksSentAt?: string | null;
}

interface ThanksEvent {
  id: string;
  name: string;
  thankYouCardUrl?: string | null;
  hostFamily?: string;
  person1?: string;
  person2?: string;
  venue?: string;
  time?: string;
  date?: string;
}

interface Props {
  open: boolean;
  eventId: string;
  event: ThanksEvent | null;
  guests: CheckedGuest[];
  isBypassed: boolean;
  credits?: number | null;
  onClose: () => void;
  onSent: () => void;
}

const VAR_FIELDS = [
  { key: 'hostFamily', label: 'Host Family' },
  { key: 'person1', label: 'Person 1' },
  { key: 'person2', label: 'Person 2' },
  { key: 'eventDate', label: 'Event Date' },
  { key: 'venue', label: 'Venue' },
  { key: 'time', label: 'Time' },
];

const DEFAULT_SMS = `Habari {guestName},

Asante kwa kushiriki katika sherehe ya {eventName}! Tunakushukuru na tunakutakia baraka nyingi.

Ahsante sana.`;

export default function ThanksCardModal({
  open,
  eventId,
  event,
  guests,
  isBypassed,
  credits,
  onClose,
  onSent,
}: Props) {
  const [tab, setTab] = useState<'whatsapp' | 'sms'>('whatsapp');
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [cardPreview, setCardPreview] = useState<string | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(event?.thankYouCardUrl || null);
  const [smsTemplate, setSmsTemplate] = useState(DEFAULT_SMS);
  const [smsVars, setSmsVars] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<
    { name: string; channel: string; success: boolean; error?: string }[]
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Checked-in guests only, split by channel.
  const checkedIn = useMemo(() => guests.filter((g) => g.checkedIn !== false && g.checkedIn !== undefined && g.checkedIn), [guests]);
  const waGuests = useMemo(() => checkedIn.filter((g) => g.routingChannel === 'whatsapp'), [checkedIn]);
  const smsGuests = useMemo(() => checkedIn.filter((g) => g.routingChannel === 'sms'), [checkedIn]);

  const waPending = isBypassed ? waGuests : waGuests.filter((g) => !g.thanksSentAt);
  const smsPending = isBypassed ? smsGuests : smsGuests.filter((g) => !g.thanksSentAt);

  const reset = () => {
    setTab('whatsapp');
    setCardFile(null);
    setCardPreview(null);
    setResults([]);
  };

  useEffect(() => {
    if (open) {
      setCardUrl(event?.thankYouCardUrl || null);
      const fmt = event?.date
        ? new Date(event.date).toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
      setSmsVars({
        hostFamily: event?.hostFamily || '',
        person1: event?.person1 || '',
        person2: event?.person2 || '',
        eventDate: fmt,
        venue: event?.venue || '',
        time: event?.time || '',
      });
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, eventId]);

  if (!open) return null;

  const pickCard = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error('Image is too large. Maximum size is 1MB.');
      return;
    }
    setCardFile(file);
    setCardPreview(URL.createObjectURL(file));
  };

  const uploadCard = async (): Promise<string | null> => {
    if (cardUrl) return cardUrl;
    if (!cardFile) {
      toast.error('Please upload a thanks card image first.');
      return null;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', cardFile);
      const res = await fetch(`/api/events/${eventId}/thanks-card`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to upload thanks card.');
        return null;
      }
      setCardUrl(data.url);
      toast.success('Thanks card uploaded.');
      return data.url as string;
    } catch {
      toast.error('Network error while uploading.');
      return null;
    } finally {
      setUploading(false);
    }
  };

  const buildSms = (g: CheckedGuest) => {
    const fullName = g.title ? `${g.title} ${g.name}` : g.name;
    const map: Record<string, string> = {
      guestName: fullName,
      name: g.name || '',
      fullName,
      cardNumber: g.cardNumber || '',
      guestType: g.guestType === 'DOUBLE' ? 'Double' : 'Single',
      eventName: event?.name || '',
      hostFamily: smsVars.hostFamily,
      person1: smsVars.person1,
      person2: smsVars.person2,
      eventDate: smsVars.eventDate,
      venue: smsVars.venue,
      time: smsVars.time,
    };
    return smsTemplate.replace(
      /\{(guestName|name|fullName|cardNumber|guestType|eventName|hostFamily|person1|person2|eventDate|venue|time)\}/g,
      (m: string, key: string) => map[key] ?? m
    );
  };

  const handleSend = async () => {
    if (tab === 'whatsapp') {
      if (waPending.length === 0) {
        toast('All WhatsApp guests already been thanked.');
        return;
      }
      const card = await uploadCard();
      if (!card) return;

      const title = `Send thanks card to ${waPending.length} WhatsApp guest${waPending.length > 1 ? 's' : ''}?`;
      const ok = await confirmToast({ title, confirmText: 'Send' });
      if (!ok) return;

      setSending(true);
      setResults([]);
      try {
        const res = await fetch(`/api/events/${eventId}/thanks-card/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ smsTemplate, smsVariables: smsVars, whatsappCardUrl: card }),
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Failed to send.');
        } else {
          setResults(data.details || []);
          if (data.successCount === (data.total ?? waPending.length)) {
            toast.success(`Thanks sent to ${data.successCount} WhatsApp guests.`);
          } else {
            toast(`${data.successCount} sent, ${data.errors?.length || 0} failed.`);
          }
          onSent();
        }
      } catch {
        toast.error('Network error.');
      } finally {
        setSending(false);
      }
    } else {
      if (smsPending.length === 0) {
        toast('All SMS guests already been thanked.');
        return;
      }
      if (!smsTemplate.trim()) {
        toast.error('Please write a thanks message.');
        return;
      }
      const ok = await confirmToast({
        title: `Send thanks SMS to ${smsPending.length} guest${smsPending.length > 1 ? 's' : ''}?`,
        confirmText: 'Send',
      });
      if (!ok) return;

      setSending(true);
      setResults([]);
      try {
        const res = await fetch(`/api/events/${eventId}/thanks-card/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ smsTemplate, smsVariables: smsVars, whatsappCardUrl: cardUrl }),
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error || 'Failed to send.');
        } else {
          setResults(data.details || []);
          if (data.successCount === (data.total ?? smsPending.length)) {
            toast.success(`Thanks sent to ${data.successCount} SMS guests.`);
          } else {
            toast(`${data.successCount} sent, ${data.errors?.length || 0} failed.`);
          }
          onSent();
        }
      } catch {
        toast.error('Network error.');
      } finally {
        setSending(false);
      }
    }
  };

  const totalCost = (tab === 'whatsapp' ? waPending.length : smsPending.length) * 300;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-pink-50 flex items-center justify-center text-pink-500">
                <Heart size={18} />
              </div>
              <div>
                <h2 className="font-serif font-bold text-lg text-gray-900">Thanks Card</h2>
                <p className="text-[11px] text-gray-400">Thank your checked-in guests</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-100">
              <X size={18} />
            </button>
          </div>

          {/* Limit notice */}
          <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-medium ${isBypassed ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {isBypassed ? <BadgeCheck size={14} /> : <Lock size={14} />}
            {isBypassed
              ? 'Bypassed account - no send limit. Guests can be thanked any number of times.'
              : 'Standard account - each guest can be thanked only once.'}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-2xl mt-3">
            <button
              onClick={() => setTab('whatsapp')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${tab === 'whatsapp' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400'}`}
            >
              <MessageCircle size={14} /> WhatsApp
              <span className="text-[10px] bg-black/5 px-1.5 rounded-full">{waPending.length}</span>
            </button>
            <button
              onClick={() => setTab('sms')}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${tab === 'sms' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
            >
              <Phone size={14} /> SMS
              <span className="text-[10px] bg-black/5 px-1.5 rounded-full">{smsPending.length}</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {tab === 'whatsapp' ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ImageIcon size={16} className="text-green-600" />
                  <p className="text-sm font-bold text-green-800">Single card · no variables</p>
                </div>
                <p className="text-[12px] text-green-700 leading-snug">
                  Upload one thanks card image. The approved WhatsApp template ({'THANKS_WHATSAPP_TEMPLATE'}) will
                  embed this same card and send it to all {waPending.length} checked-in WhatsApp guest{waPending.length !== 1 ? 's' : ''}.
                </p>
              </div>

              {cardPreview || cardUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cardPreview || cardUrl || ''}
                    alt="Thanks card"
                    className="w-full max-h-72 object-contain rounded-2xl border border-gray-200 bg-gray-50"
                  />
                  <button
                    onClick={() => { setCardFile(null); setCardPreview(null); }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-white shadow border border-gray-200 text-gray-500"
                  >
                    <Undo2 size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-green-300 bg-green-50/50 flex flex-col items-center justify-center gap-2 text-green-600 hover:bg-green-50"
                >
                  <Upload size={24} />
                  <span className="text-sm font-semibold">Upload thanks card</span>
                  <span className="text-[10px] text-green-500">PNG / JPG</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickCard(f); }}
              />

              {waPending.length > 0 && !isBypassed && (
                <div className="text-[11px] text-gray-400">
                  {waGuests.length - waPending.length} already thanked.
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {waGuests.map((g) => {
                  const thanked = !isBypassed && g.thanksSentAt;
                  return (
                    <span key={g.id} className={`text-[10px] px-2 py-1 rounded-full border ${thanked ? 'bg-gray-50 text-gray-400 border-gray-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                      {thanked && <CheckCircle2 size={10} className="inline mr-1" />}
                      {g.name}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <PartyPopper size={16} className="text-blue-600" />
                  <p className="text-sm font-bold text-blue-800">Individualized message · variables</p>
                </div>
                <p className="text-[12px] text-blue-700 leading-snug">
                  This message will be sent to {smsPending.length} checked-in SMS guest{smsPending.length !== 1 ? 's' : ''}.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {VAR_FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="block text-[10px] font-medium text-gray-500 mb-1">{f.label}</label>
                    <input
                      type="text"
                      value={smsVars[f.key] || ''}
                      onChange={(e) => setSmsVars((p) => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full p-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0D4B4B]"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-[10px] font-medium text-gray-500 mb-1">
                  Thanks message · <code className="text-blue-600">{'{{guestName}}'} {'{{eventName}}'}</code>
                </label>
                <textarea
                  value={smsTemplate}
                  onChange={(e) => setSmsTemplate(e.target.value)}
                  rows={6}
                  className="w-full p-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:ring-2 focus:ring-[#0D4B4B] resize-none"
                />
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl p-3">
                <p className="text-[10px] font-medium text-gray-400 uppercase mb-1.5">Preview (first SMS guest)</p>
                <p className="text-xs text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl p-3 border border-gray-100">
                  {smsPending[0] ? buildSms(smsPending[0]) : 'No SMS guests to preview.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {smsGuests.map((g) => {
                  const thanked = !isBypassed && g.thanksSentAt;
                  return (
                    <span key={g.id} className={`text-[10px] px-2 py-1 rounded-full border ${thanked ? 'bg-gray-50 text-gray-400 border-gray-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                      {thanked && <CheckCircle2 size={10} className="inline mr-1" />}
                      {g.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-4 max-h-40 overflow-y-auto space-y-1">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] px-3 py-1.5 rounded-lg bg-gray-50">
                  <span className={r.success ? 'text-green-600' : 'text-red-500'}>
                    {r.success ? <CheckCircle2 size={13} /> : <Info size={13} />}
                  </span>
                  <span className="font-medium text-gray-700">{r.name}</span>
                  {!r.success && <span className="text-red-500 ml-auto truncate">{r.error}</span>}
                  {r.success && <span className="text-gray-400 ml-auto">{r.channel}</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 shrink-0">
          {!isBypassed && (
            <p className="text-center text-[10px] text-gray-400 mb-2">
              Estimated cost: <b>{totalCost.toLocaleString()}</b> credits{credits != null && ` · Balance: ${credits.toLocaleString()}`}
            </p>
          )}
          <button
            onClick={handleSend}
            disabled={sending || uploading}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-br from-[#0D4B4B] to-[#0A3939] text-white font-bold text-sm shadow-md shadow-[#0D4B4B]/20 disabled:opacity-50"
          >
            {sending || uploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {uploading ? 'Uploading...' : sending ? 'Sending...' : `Send to ${tab === 'whatsapp' ? waPending.length : smsPending.length} guest${(tab === 'whatsapp' ? waPending.length : smsPending.length) !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
