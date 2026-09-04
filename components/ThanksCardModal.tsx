'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import {
  X, Upload,
  Loader2, Send, CheckCircle2, MessageCircle, MessageSquareText,
  Users, RotateCcw,
} from 'lucide-react';
import { confirmToast } from '@/lib/confirmToast';
import { guestTypeLabel } from '@/lib/guestTypes';

interface ThanksGuest {
  id: string;
  name: string;
  title?: string | null;
  phone?: string | null;
  checkedIn?: boolean;
  guestType?: string | null;
  cardNumber?: string | null;
  thanksSentAt?: string | null;
}

interface ThanksEvent {
  id: string;
  name: string;
  thankYouCardUrl?: string | null;
}

interface Props {
  open: boolean;
  eventId: string;
  event: ThanksEvent | null;
  guests: ThanksGuest[];
  isBypassed: boolean;
  credits?: number | null;
  onClose: () => void;
  onSent: () => void;
}

const DEFAULT_SMS_MESSAGE =
  'Ahsante {guestName} kwa kufika na kufanya siku yetu kuwa maalum. Tunashukuru sana!';

type Channel = 'whatsapp' | 'sms';

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
  const [channel, setChannel] = useState<Channel>('whatsapp');
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [cardPreview, setCardPreview] = useState<string | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(event?.thankYouCardUrl || null);
  const [smsMessage, setSmsMessage] = useState<string>(DEFAULT_SMS_MESSAGE);
  const [includeAll, setIncludeAll] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<
    { name: string; channel: string; success: boolean; error?: string }[]
  >([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // All checked-in guests; optionally expand to include every guest.
  const baseGuests = useMemo(
    () => guests.filter((g) => g.phone),
    [guests]
  );
  const recipients = useMemo(
    () =>
      includeAll
        ? baseGuests
        : baseGuests.filter((g) => g.checkedIn === true),
    [baseGuests, includeAll]
  );

  // Track whether each guest has already been thanked on the current channel.
  const pending = useMemo(() => {
    // Client only knows about WhatsApp thanks (thanksSentAt). SMS thanks are
    // tracked server-side via smsThanksSentAt; the server dedups for us.
    if (channel === 'whatsapp' && !isBypassed) {
      return recipients.filter((g) => !g.thanksSentAt);
    }
    return recipients;
  }, [recipients, channel, isBypassed]);

  const getFullName = (g: ThanksGuest) => (g.title ? `${g.title} ${g.name}` : g.name);

  const reset = () => {
    setCardFile(null);
    setCardPreview(null);
    setResults([]);
    setIncludeAll(false);
  };

  useEffect(() => {
    if (open) {
      setCardUrl(event?.thankYouCardUrl || null);
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

  const insertGuestName = () => {
    const textarea = document.getElementById('thanks-sms-editor') as HTMLTextAreaElement | null;
    const start = textarea?.selectionStart ?? smsMessage.length;
    const end = textarea?.selectionEnd ?? smsMessage.length;
    const next = smsMessage.slice(0, start) + '{guestName}' + smsMessage.slice(end);
    setSmsMessage(next);
    setTimeout(() => {
      textarea?.focus();
      textarea?.setSelectionRange(start + '{guestName}'.length, start + '{guestName}'.length);
    }, 10);
  };

  const previewMessage = useMemo(
    () => smsMessage.replace(/\{guestName\}/g, () => 'Mr John Doe'),
    [smsMessage]
  );

  const handleSend = async () => {
    if (pending.length === 0) {
      toast('All guests have already been thanked on this channel.');
      return;
    }

    let card: string | null = null;
    if (channel === 'whatsapp') {
      card = await uploadCard();
      if (!card) return;
    }

    const label = channel === 'whatsapp' ? 'WhatsApp' : 'SMS';
    const title = `Send ${label} thanks to ${pending.length} guest${pending.length > 1 ? 's' : ''}?`;
    const ok = await confirmToast({ title, confirmText: 'Send' });
    if (!ok) return;

    setSending(true);
    setResults([]);
    try {
      const res = await fetch(`/api/events/${eventId}/thanks-card/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          whatsappCardUrl: card,
          message: smsMessage,
          includeAll,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to send.');
      } else {
        setResults(data.details || []);
        const total = data.total ?? pending.length;
        if (data.successCount === total) {
          toast.success(`${label} thanks sent to ${data.successCount} guest${data.successCount > 1 ? 's' : ''}.`);
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
  };

  const totalCost = pending.length * 300;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full sm:max-w-md bg-[#F5F5F7] sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-7 pb-4 bg-gradient-to-b from-[#0D4B4B] to-[#0A3939] text-white shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-white/60 font-medium">Thank you</p>
              <h2 className="font-serif font-bold text-2xl leading-tight">Thanks Card</h2>
              <p className="text-[12px] text-white/70 mt-0.5">{event?.name}</p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/15 text-white flex items-center justify-center hover:bg-white/25 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* iOS-style segmented control */}
        <div className="px-4 pt-4 shrink-0">
          <div className="bg-gray-200/70 rounded-[12px] p-1 flex">
            <button
              onClick={() => setChannel('whatsapp')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[9px] text-sm font-semibold transition-all ${
                channel === 'whatsapp'
                  ? 'bg-white text-[#0D4B4B] shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              <MessageCircle size={16} className={channel === 'whatsapp' ? 'text-[#25D366]' : 'text-gray-400'} />
              WhatsApp
            </button>
            <button
              onClick={() => setChannel('sms')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-[9px] text-sm font-semibold transition-all ${
                channel === 'sms'
                  ? 'bg-white text-[#0D4B4B] shadow-sm'
                  : 'text-gray-500'
              }`}
            >
              <MessageSquareText size={16} className={channel === 'sms' ? 'text-[#0D4B4B]' : 'text-gray-400'} />
              SMS
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Recipients summary */}
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
            <div className="flex items-center gap-2 mb-1">
              <Users size={15} className="text-[#0D4B4B]" />
              <span className="text-sm font-semibold text-gray-800">
                {pending.length} guest{pending.length !== 1 ? 's' : ''}
              </span>
              {isBypassed ? (
                <span className="ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">
                  Unlimited
                </span>
              ) : (
                channel === 'whatsapp' && (
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                    {recipients.length - pending.length} already thanked
                  </span>
                )
              )}
            </div>

            {/* Toggle: include all guests */}
            <button
              onClick={() => setIncludeAll((v) => !v)}
              className="mt-3 w-full flex items-center justify-between rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5"
            >
              <span className="text-[13px] text-gray-700 font-medium">Include all guests</span>
              <span
                className={`relative w-11 h-6 rounded-full transition-colors ${includeAll ? 'bg-[#0D4B4B]' : 'bg-gray-300'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    includeAll ? 'translate-x-5' : ''
                  }`}
                />
              </span>
            </button>
            <p className="text-[11px] text-gray-400 mt-1.5 leading-snug">
              {includeAll
                ? 'Sending to every guest with a phone number, not just checked-in ones.'
                : 'Sending to guests who have checked in.'}
            </p>
          </div>

          {channel === 'whatsapp' ? (
            /* ─── WhatsApp: card upload ─── */
            <div className="space-y-3">
              {cardPreview || cardUrl ? (
                <div className="relative rounded-2xl overflow-hidden shadow-sm bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cardPreview || cardUrl || ''}
                    alt="Thanks card"
                    className="w-full max-h-72 object-contain bg-gray-50"
                  />
                  <button
                    onClick={() => { setCardFile(null); setCardPreview(null); }}
                    className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white shadow border border-gray-200 text-gray-500 flex items-center justify-center"
                  >
                    <RotateCcw size={15} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed border-[#0D4B4B]/30 bg-white flex flex-col items-center justify-center gap-2 text-[#0D4B4B] hover:bg-[#0D4B4B]/5 transition"
                >
                  <div className="w-14 h-14 rounded-2xl bg-[#0D4B4B]/10 flex items-center justify-center">
                    <Upload size={22} />
                  </div>
                  <span className="text-sm font-semibold">Upload thanks card</span>
                  <span className="text-[10px] text-gray-400">PNG / JPG · up to 1MB</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) pickCard(f); }}
              />
              <p className="text-center text-[11px] text-gray-400">
                Shared via the approved WhatsApp template as an attachment.
              </p>
            </div>
          ) : (
            /* ─── SMS: editable message with guestName variable ─── */
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <label className="block text-sm font-semibold text-gray-800 mb-1">
                Message
              </label>
              <p className="text-[11px] text-gray-400 mb-2">
                The same message goes to every guest, with their name filled in.
              </p>

              <button
                type="button"
                onClick={insertGuestName}
                className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[#0D4B4B]/10 text-[#0D4B4B] text-xs font-semibold px-3 py-1.5 hover:bg-[#0D4B4B]/20 transition"
              >
                + <span className="font-mono">{`{guestName}`}</span>
              </button>

              <textarea
                id="thanks-sms-editor"
                value={smsMessage}
                onChange={(e) => setSmsMessage(e.target.value)}
                placeholder="Write your thanks message..."
                className="w-full p-4 border border-gray-200 rounded-2xl text-sm focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent min-h-[160px] resize-y"
              />
              <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
                <span>{smsMessage.length} characters</span>
              </div>

              <div className="mt-3 p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Preview</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{previewMessage}</p>
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div className="mt-4 bg-white rounded-2xl shadow-sm divide-y divide-gray-50 max-h-44 overflow-y-auto">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                  <span className={r.success ? 'text-green-500' : 'text-red-400'}>
                    {r.success ? <CheckCircle2 size={16} /> : <MessageCircle size={16} />}
                  </span>
                  <span className="font-medium text-gray-700 text-sm">{r.name}</span>
                  {r.success ? (
                    <span className="text-[10px] text-gray-400 ml-auto uppercase tracking-wide">{r.channel}</span>
                  ) : (
                    <span className="text-[10px] text-red-500 ml-auto truncate max-w-[50%]">{r.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-4 border-t border-gray-200/60 bg-white/90 backdrop-blur shrink-0">
          {!isBypassed && (
            <p className="text-center text-[10px] text-gray-400 mb-2.5">
              Estimated cost: <b className="text-gray-600">{totalCost.toLocaleString()}</b> credits
              {credits != null && ` · Balance: ${credits.toLocaleString()}`}
            </p>
          )}
          <button
            onClick={handleSend}
            disabled={sending || uploading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-[#0D4B4B] text-white font-bold text-sm shadow-lg shadow-[#0D4B4B]/20 active:scale-[0.99] transition disabled:opacity-50"
          >
            {sending || uploading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {uploading ? 'Uploading...' : sending ? 'Sending...' : `Send ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} thanks`}
          </button>
        </div>
      </div>
    </div>
  );
}
