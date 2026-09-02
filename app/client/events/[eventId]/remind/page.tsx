'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Send, Loader2, Users, CheckSquare, Square, X,
  MessageCircle, Phone, Info, Gift, Bell, MessageSquare,
  FileText, Hash, Coins, ShieldCheck,
  ImageUp, AlignLeft, AlignCenter, AlignRight, Trash2, Palette
} from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';
import ModernColorPicker from '@/app/components/ModernColorPicker';

const REMINDER_FONTS = [
  'Playfair Display', 'DM Sans', 'Roboto', 'Lora', 'Montserrat',
  'Georgia', 'Open Sans', 'Raleway', 'Nunito', 'Poppins',
  'Great Vibes', 'Parisienne', 'Alex Brush', 'Tangerine',
  'Dancing Script', 'Pacifico', 'Satisfy', 'Cedarville Cursive', 'Kaushan Script'
];

interface Guest {
  id: string;
  name: string;
  title?: string | null;
  phone: string | null;
  reminderCount: number;
  routingChannel: string;
  checkedIn?: boolean;
  cardNumber?: string | null;
}

interface EventData {
  id: string;
  name: string;
  manualReminderSent?: boolean;
  reminderCardUrl?: string | null;
  reminderCardNameX?: number | null;
  reminderCardNameY?: number | null;
  reminderCardNameSize?: number | null;
  reminderCardNameColor?: string | null;
  reminderCardNameAlign?: string | null;
  reminderCardNameFont?: string | null;
}

type Channel = 'whatsapp' | 'sms';

interface GuestCard {
  url: string;
  width?: number;
  height?: number;
}

interface CardDesign {
  x: number;
  y: number;
  size: number;
  color: string;
  align: 'left' | 'center' | 'right';
  font: string;
}

export default function RemindGuestsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const router = useRouter();
  const [eventId, setEventId] = useState<string | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<number | null>(null);
  const [bypassPayment, setBypassPayment] = useState(false);
  const [channel, setChannel] = useState<Channel>('sms');

  // Reminder card mini-designer state
  const [card, setCard] = useState<GuestCard | null>(null);
  const [cardDesign, setCardDesign] = useState<CardDesign>({
    x: 50,
    y: 40,
    size: 34,
    color: '#ffffff',
    align: 'center',
    font: 'Playfair Display',
  });
  const [uploadingCard, setUploadingCard] = useState(false);
  const [savingDesign, setSavingDesign] = useState(false);

  const fetchEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/events/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load event');
      const data = await res.json();
      setEvent(data.event);
      setGuests(data.guests || []);
      setBypassPayment(!!data.bypassPayment);
      if (data.event?.reminderCardUrl) {
        setCard({ url: data.event.reminderCardUrl });
        setCardDesign({
          x: data.event.reminderCardNameX ?? 50,
          y: data.event.reminderCardNameY ?? 40,
          size: data.event.reminderCardNameSize ?? 34,
          color: data.event.reminderCardNameColor ?? '#ffffff',
          align: data.event.reminderCardNameAlign === 'left' || data.event.reminderCardNameAlign === 'right'
            ? data.event.reminderCardNameAlign
            : 'center',
          font: data.event.reminderCardNameFont ?? 'Playfair Display',
        });
      }
    } catch {
      toast.error('Could not load event data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCredits = async () => {
    try {
      const res = await fetch('/api/tenant/billing', { credentials: 'include' });
      const data = await res.json();
      setCredits(data.tenant?.credits ?? 0);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    params.then(({ eventId }) => {
      setEventId(eventId);
      fetchEvent(eventId);
      fetchCredits();
    });
  }, [params]);

  // All guests for the active channel (both checked-in and pending can be reminded)
  const channelGuests = guests.filter(g => g.routingChannel === channel);
  const whatsappGuests = guests.filter(g => g.routingChannel === 'whatsapp');
  const smsGuests = guests.filter(g => g.routingChannel === 'sms');

  const toggleSelectAll = () => {
    if (selectedGuests.size === channelGuests.length) {
      setSelectedGuests(new Set());
    } else {
      setSelectedGuests(new Set(channelGuests.map(g => g.id)));
    }
  };

  const toggleSelectGuest = (id: string) => {
    const newSet = new Set(selectedGuests);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedGuests(newSet);
  };

  const selectChannel = (c: Channel) => {
    setChannel(c);
    setSelectedGuests(new Set());
  };

  const handleCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !eventId) return;

    const valid = ['image/jpeg', 'image/jpg', 'image/png'].includes(file.type);
    if (!valid) {
      toast.error('Please upload a JPEG, JPG or PNG image.');
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error('Image is too large. Maximum size is 1MB.');
      return;
    }

    setUploadingCard(true);
    const formData = new FormData();
    formData.append('image', file);
    formData.append('eventId', eventId);
    try {
      const res = await fetch('/api/events/upload-reminder-card', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setCard({ url: data.url });
      toast.success('Card uploaded. Adjust the highlight below, then save.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed. Please try again.');
    } finally {
      setUploadingCard(false);
    }
  };

  const saveCardDesign = async () => {
    if (!eventId) return;
    setSavingDesign(true);
    try {
      const res = await fetch(`/api/events/${eventId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminderCardUrl: card?.url ?? null,
          reminderCardNameX: cardDesign.x,
          reminderCardNameY: cardDesign.y,
          reminderCardNameSize: cardDesign.size,
          reminderCardNameColor: cardDesign.color,
          reminderCardNameAlign: cardDesign.align,
          reminderCardNameFont: cardDesign.font,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      toast.success('Reminder card saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save design.');
    } finally {
      setSavingDesign(false);
    }
  };

  const removeCard = async () => {
    if (!eventId) return;
    setCard(null);
    setCardDesign({ x: 50, y: 40, size: 34, color: '#ffffff', align: 'center', font: 'Playfair Display' });
    try {
      await fetch(`/api/events/${eventId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reminderCardUrl: null,
          reminderCardNameX: 50,
          reminderCardNameY: 40,
          reminderCardNameSize: 34,
          reminderCardNameColor: '#ffffff',
          reminderCardNameAlign: 'center',
          reminderCardNameFont: 'Playfair Display',
        }),
        credentials: 'include',
      });
    } catch {
      // ignore — the local reset is enough
    }
  };

  const selectedCount = selectedGuests.size;
  // Once-per-event lock: non-bypassed tenants can use the manual reminder once (per channel).
  const alreadyUsed = !bypassPayment && !!event?.manualReminderSent;
  // Cost in credits: first 2 reminders per guest free, then 50 credits each
  const totalCost = channelGuests
    .filter(g => selectedGuests.has(g.id))
    .reduce((sum, g) => sum + (g.reminderCount < 2 ? 0 : 50), 0);

  const sendReminders = async () => {
    if (alreadyUsed) {
      toast.error('Reminder messages have already been sent for this event.');
      return;
    }
    if (selectedCount === 0) {
      toast.error('Please select at least one guest.');
      return;
    }
    if (channel === 'sms' && !message.trim()) {
      toast.error('Please enter a message.');
      return;
    }
    if (totalCost > 0 && credits !== null && credits < totalCost) {
      toast.error(`Insufficient credits. Need ${totalCost} credits, you have ${credits} credits.`);
      return;
    }
    const costText = totalCost === 0 ? 'Free' : `${totalCost} credits`;
    const ok = await confirmToast({
      title: `Send ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} reminder to ${selectedCount} guest${selectedCount > 1 ? 's' : ''}?`,
      message: `Cost: ${costText}.`,
      confirmText: 'Send',
    });
    if (!ok) return;

    setSending(true);
    try {
      const res = await fetch(`/api/events/${eventId}/send-reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestIds: Array.from(selectedGuests),
          message,
          channel,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        if (data.successCount === selectedCount) {
          toast.success(`Reminder sent to ${data.successCount} guest${data.successCount > 1 ? 's' : ''}.`);
        } else {
          toast.success(`Reminder sent to ${data.successCount}/${selectedCount} guest${selectedCount > 1 ? 's' : ''}.`);
          if (data.errors && data.errors.length > 0) {
            console.error('Reminder errors:', data.errors);
            toast.error('Some messages did not send. Please try again or contact support.');
          }
        }
        if (typeof data.remainingCredits === 'number') setCredits(data.remainingCredits);
        if (data.channel === 'whatsapp' && data.successCount > 0) {
          toast.success('WhatsApp reminders sent with the guest name filled in automatically.');
        }
        fetchEvent(eventId!);
        router.push(`/client/events/${eventId}`);
      } else {
        console.error('Reminder API error:', data.error);
        toast.error(data.error || 'Failed to send reminders. Please try again.');
      }
    } catch (error) {
      console.error('Network error:', error);
      toast.error('Network error. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh] bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-[#0D4B4B]" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-center px-6">
        <AlertGlyph />
        <p className="text-gray-500 mt-3">Event not found.</p>
        <Link href="/client/dashboard" className="text-[#0D4B4B] underline mt-2 inline-block">
          Go back
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="max-w-lg mx-auto px-4 py-6 sm:px-6">
        {/* ─── Header ─── */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/client/events/${eventId}`}
            className="flex-shrink-0 w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-600 hover:text-[#0D4B4B] hover:border-[#0D4B4B] transition"
          >
            <ArrowLeft size={17} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-serif text-xl sm:text-2xl font-black text-gray-900 truncate leading-tight">
              Remind guests
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">{event.name}</p>
          </div>
        </div>

        {alreadyUsed ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <Bell size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800">Reminder already sent</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Reminders can only be sent once per event. If you need to reach guests again, please contact support.
              </p>
            </div>
          </div>
        ) : bypassPayment ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
            <ShieldCheck size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-green-800">Unlimited reminders</p>
              <p className="text-sm text-green-700 mt-0.5">
                Your account is set to bypass usage limits, so you can send reminders as many times as you need.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-2xl p-4 mb-4">
            <div className="flex items-center gap-2">
              <Coins size={18} className="text-amber-600" />
              <span className="text-sm text-gray-600">Available credits:</span>
              <span className="font-bold text-gray-900">{credits !== null ? credits.toLocaleString() : '—'}</span>
            </div>
            <Link href="/client/billing" className="text-xs font-semibold text-[#0D4B4B] hover:underline">
              Buy / request
            </Link>
          </div>
        )}

        {/* ─── Channel selection ─── */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={() => selectChannel('sms')}
            className={`rounded-2xl border p-4 text-left transition ${
              channel === 'sms'
                ? 'border-[#0D4B4B] bg-[#0D4B4B]/[0.04] ring-2 ring-[#0D4B4B]/10'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Phone size={16} className="text-gray-600" />
              <span className="font-semibold text-gray-900 text-sm">SMS</span>
            </div>
            <p className="text-xs text-gray-500">{smsGuests.length} guests</p>
          </button>
          <button
            type="button"
            onClick={() => selectChannel('whatsapp')}
            className={`rounded-2xl border p-4 text-left transition ${
              channel === 'whatsapp'
                ? 'border-[#25D366] bg-[#25D366]/[0.05] ring-2 ring-[#25D366]/15'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle size={16} className="text-[#15803d]" />
              <span className="font-semibold text-gray-900 text-sm">WhatsApp</span>
            </div>
            <p className="text-xs text-gray-500">{whatsappGuests.length} guests</p>
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {/* ─── Header row ─── */}
          <div className="p-5 border-b border-gray-100">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleSelectAll}
                  disabled={alreadyUsed || channelGuests.length === 0}
                  className="text-sm text-gray-600 hover:text-[#0D4B4B] flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {selectedGuests.size === channelGuests.length && channelGuests.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                  {selectedGuests.size === channelGuests.length && channelGuests.length > 0 ? 'Deselect All' : 'Select All'}
                </button>
                <span className="text-sm text-gray-500">
                  {selectedCount} selected · {channelGuests.length} {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} guests
                </span>
              </div>
              <div className="text-sm">
                <span className="font-medium">
                  Cost: {totalCost === 0 ? 'Free' : `${totalCost} credits`}
                  <span className="text-xs text-gray-400 block">
                    <Info size={10} className="inline mr-0.5" />
                    First 2 reminders per guest are free
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="p-5">
            {channel === 'whatsapp' ? (
              /* ─── WhatsApp reminder card designer ─── */
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <MessageCircle size={16} className="text-[#15803d]" />
                  <h2 className="font-semibold text-gray-800">Reminder card</h2>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Upload a card image (JPEG, JPG or PNG) and use the {'{GuestName}'} overlay. Each selected
                  guest receives this card with their own name highlighted — no typing needed.
                </p>

                {!card ? (
                  /* ─── Upload zone ─── */
                  <label className="block cursor-pointer">
                    <input
                      type="file"
                      accept=".jpeg,.jpg,.png,image/jpeg,image/jpg,image/png"
                      className="hidden"
                      onChange={handleCardUpload}
                    />
                    <div className="border-2 border-dashed border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:border-[#0D4B4B] hover:bg-[#0D4B4B]/[0.02] transition">
                      {uploadingCard ? (
                        <>
                          <Loader2 size={28} className="text-[#0D4B4B] animate-spin mb-2" />
                          <p className="text-sm font-medium text-gray-600">Uploading…</p>
                        </>
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-full bg-[#0D4B4B]/[0.06] flex items-center justify-center mb-2">
                            <ImageUp size={22} className="text-[#0D4B4B]" />
                          </div>
                          <p className="text-sm font-semibold text-gray-700">Upload a reminder card</p>
                          <p className="text-xs text-gray-400 mt-1 max-w-[220px]">
                            JPEG, JPG or PNG · up to 1MB
                          </p>
                        </>
                      )}
                    </div>
                  </label>
                ) : (
                  /* ─── Preview + controls ─── */
                  <div className="space-y-4">
                    <div className="mx-auto max-w-[260px]">
                      <div
                        className="relative rounded-2xl overflow-hidden"
                        style={{ containerType: 'inline-size' }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={card.url}
                          alt="Reminder card"
                          className="w-full h-auto block"
                        />
                        <div
                          className="absolute"
                          style={{
                            width: '100%',
                            top: `${cardDesign.y}%`,
                            left: cardDesign.align === 'center'
                              ? `${cardDesign.x}%`
                              : cardDesign.align === 'right'
                                ? `${100 - cardDesign.x}%`
                                : `${cardDesign.x}%`,
                            transform: cardDesign.align === 'center'
                              ? 'translate(-50%, -50%)'
                              : cardDesign.align === 'right'
                                ? 'translate(0, -50%)'
                                : 'none',
                          }}
                        >
                          <span
                            className="inline-block font-bold whitespace-nowrap leading-tight text-center"
                            style={{
                              fontSize: `calc(${cardDesign.size || 34} / 8 * 1cqw)`,
                              color: cardDesign.color || '#ffffff',
                              fontFamily: `'${cardDesign.font}', Georgia, serif`,
                              textShadow: '0 2px 6px rgba(0,0,0,0.45)',
                            }}
                          >
                            {'{GuestName}'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-center text-gray-400 mt-1.5">
                        Live preview — each guest sees their own name here.
                      </p>
                    </div>

                    {/* Controls */}
                    <div className="space-y-3.5 bg-gray-50 rounded-2xl p-4">
                      {/* Font */}
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">Font</label>
                        <select
                          value={cardDesign.font}
                          onChange={(e) => setCardDesign({ ...cardDesign, font: e.target.value })}
                          className="w-full p-2 border border-gray-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent"
                        >
                          {REMINDER_FONTS.map(f => (
                            <option key={f} value={f} style={{ fontFamily: `'${f}', Georgia, serif` }}>
                              {f}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Size */}
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">
                          Text size · {cardDesign.size}px
                        </label>
                        <input
                          type="range"
                          min={14}
                          max={90}
                          value={cardDesign.size}
                          onChange={(e) => setCardDesign({ ...cardDesign, size: Number(e.target.value) })}
                          className="w-full accent-[#0D4B4B]"
                        />
                      </div>

                      {/* Alignment */}
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1">
                          Alignment
                        </label>
                        <div className="flex gap-1">
                          {(['left', 'center', 'right'] as const).map((a) => {
                            const Icon = a === 'left' ? AlignLeft : a === 'center' ? AlignCenter : AlignRight;
                            return (
                              <button
                                key={a}
                                type="button"
                                onClick={() => setCardDesign({ ...cardDesign, align: a })}
                                className={`flex-1 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1 capitalize ${
                                  cardDesign.align === a
                                    ? 'bg-[#0D4B4B] text-white'
                                    : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
                                }`}
                              >
                                <Icon size={13} /> {a}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* X & Y position */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-gray-500 mb-1">Horizontal · {cardDesign.x}%</label>
                          <input
                            type="range"
                            min={5}
                            max={95}
                            value={cardDesign.x}
                            onChange={(e) => setCardDesign({ ...cardDesign, x: Number(e.target.value) })}
                            className="w-full accent-[#0D4B4B]"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-gray-500 mb-1">Vertical · {cardDesign.y}%</label>
                          <input
                            type="range"
                            min={5}
                            max={95}
                            value={cardDesign.y}
                            onChange={(e) => setCardDesign({ ...cardDesign, y: Number(e.target.value) })}
                            className="w-full accent-[#0D4B4B]"
                          />
                        </div>
                      </div>

                      {/* Color */}
                      <div>
                        <label className="block text-[11px] font-medium text-gray-500 mb-1 flex items-center gap-1">
                          <Palette size={12} /> Text color
                        </label>
                        <ModernColorPicker
                          value={cardDesign.color}
                          onChange={(c) => setCardDesign({ ...cardDesign, color: c })}
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={saveCardDesign}
                          disabled={savingDesign}
                          className="flex-1 bg-[#0D4B4B] text-white py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {savingDesign ? <Loader2 size={15} className="animate-spin" /> : <Palette size={15} />}
                          Save design
                        </button>
                        <button
                          onClick={removeCard}
                          className="px-4 border border-gray-200 rounded-xl text-gray-500 hover:text-red-600 hover:border-red-200 transition flex items-center justify-center"
                          title="Remove card"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ─── SMS message ─── */
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                  <FileText size={15} />
                  SMS Message
                  <span className="text-gray-400 text-xs font-normal ml-1">(use {'{name}'} for guest name)</span>
                </label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent resize-none"
                  placeholder="e.g. Habari {name}, tunakumbusha kuhusu mchango wako kwa {event}. Asante."
                />
              </div>
            )}

            {/* ─── Guest list ─── */}
            {channelGuests.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-xl">
                <Users size={28} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  No {channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} guests to remind.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {channel === 'whatsapp'
                    ? 'Switch to SMS to see the other channel.'
                    : 'Switch to WhatsApp to see the other channel.'}
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
                {channelGuests.map((guest) => (
                  <div
                    key={guest.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedGuests.has(guest.id)}
                      onChange={() => toggleSelectGuest(guest.id)}
                      disabled={alreadyUsed}
                      className="w-4 h-4 rounded border-gray-300 text-[#0D4B4B] focus:ring-[#0D4B4B] disabled:opacity-40"
                    />
                    <div className="flex-1">
                      <p className="font-medium text-gray-800">{guest.name}</p>
                      <p className="text-xs text-gray-500">{guest.phone}</p>
                    </div>
                    <div className="text-xs text-gray-400 flex flex-col items-end gap-0.5">
                      {guest.reminderCount < 2 ? (
                        <span className="text-[#0D4B4B] flex items-center gap-0.5">
                          <Gift size={10} /> Free
                        </span>
                      ) : (
                        <span>50 credits</span>
                      )}
                      <span className="bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <Hash size={9} />
                        {guest.reminderCount} sent
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <MessageSquare size={12} />
              All guests are shown — send a reminder to anyone who hasn&apos;t been reminded yet.
            </p>

            <div className="mt-6 flex gap-3">
              <button
                onClick={sendReminders}
                disabled={sending || alreadyUsed || selectedCount === 0 || (channel === 'sms' && !message.trim()) || (totalCost > 0 && credits !== null && credits < totalCost)}
                className="flex-1 bg-gradient-to-r from-[#0D4B4B] to-[#0A3939] text-white py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={18} />}
                {sending ? 'Sending...' : `Send ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} Reminder${selectedCount > 1 ? 's' : ''}`}
              </button>
              <button
                onClick={() => router.push(`/client/events/${eventId}`)}
                className="px-6 border border-gray-300 rounded-xl py-2.5 font-medium hover:bg-gray-50 transition flex items-center gap-1.5"
              >
                <X size={16} />
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AlertGlyph() {
  return (
    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
      <Bell size={28} className="text-gray-400" />
    </div>
  );
}
