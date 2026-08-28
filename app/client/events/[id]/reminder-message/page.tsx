'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, Send, Loader2, Users, CheckSquare, Square, X, 
  MessageCircle, Phone, Info, Sparkles, Calendar, User,
  CreditCard, AlertCircle, CheckCircle, Bell, MessageSquare,
  FileText, CornerDownRight, Hash
} from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';

interface Guest {
  id: string;
  name: string;
  phone: string;
  reminderCount: number;
  routingChannel: string;
}

interface Event {
  id: string;
  name: string;
  manualReminderSent?: boolean;
}

export default function ReminderMessagePage({ params }: { params: Promise<{ eventId: string }> }) {
  const router = useRouter();
  const [eventId, setEventId] = useState<string | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [credits, setCredits] = useState<number | null>(null);
  const [bypassPayment, setBypassPayment] = useState(false);

  useEffect(() => {
    params.then(({ eventId }) => {
      setEventId(eventId);
      fetchEvent(eventId);
      fetchCredits();
    });
  }, [params]);

  const fetchEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/events/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load event');
      const data = await res.json();
      setEvent(data.event);
      setGuests(data.guests || []);
      setBypassPayment(!!data.bypassPayment);
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

  const toggleSelectAll = () => {
    if (selectedGuests.size === guests.length) {
      setSelectedGuests(new Set());
    } else {
      setSelectedGuests(new Set(guests.map(g => g.id)));
    }
  };

  const toggleSelectGuest = (id: string) => {
    const newSet = new Set(selectedGuests);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedGuests(newSet);
  };

  const selectedCount = selectedGuests.size;
  // Once-per-event lock: non-bypassed tenants can use the manual reminder once.
  const alreadyUsed = !bypassPayment && !!event?.manualReminderSent;
  // Cost: first 2 reminders free, then 50 TZS each
  const totalCost = guests
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
    if (!message.trim()) {
      toast.error('Please enter a message.');
      return;
    }
    if (totalCost > 0 && credits !== null && credits < totalCost) {
      toast.error(`Insufficient credits. Need ${totalCost} TZS, you have ${credits} TZS.`);
      return;
    }
    const costText = totalCost === 0 ? 'Free' : `${totalCost} TZS`;
    const ok = await confirmToast({ title: `Send reminder to ${selectedCount} guest${selectedCount > 1 ? 's' : ''}?`, message: `Cost: ${costText}.`, confirmText: 'Send' });
    if (!ok) return;

    setSending(true);
    try {
      const res = await fetch(`/api/events/${eventId}/send-reminders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestIds: Array.from(selectedGuests),
          message,
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
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0D4B4B]" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-500">Event not found.</p>
        <Link href="/client/dashboard" className="text-[#0D4B4B] underline mt-2 inline-block">
          Go back
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/client/events/${eventId}`}
          className="text-gray-500 hover:text-[#0D4B4B] transition"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-serif text-2xl font-black text-gray-900">
          Kumbusha Michango – {event.name}
        </h1>
      </div>

      {alreadyUsed ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-800">Reminder already sent</p>
            <p className="text-sm text-amber-700 mt-0.5">
              Reminder messages can only be sent once per event. This event has already used its
              reminder. If you need to reach guests again, please contact support.
            </p>
          </div>
        </div>
      ) : bypassPayment ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <CheckCircle size={20} className="text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-green-800">Unlimited reminders</p>
            <p className="text-sm text-green-700 mt-0.5">
              Your account is set to bypass usage limits, so you can send reminders as many times as
              you need.
            </p>
          </div>
        </div>
      ) : null}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={toggleSelectAll}
                disabled={alreadyUsed}
                className="text-sm text-gray-600 hover:text-[#0D4B4B] flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {selectedGuests.size === guests.length ? <CheckSquare size={16} /> : <Square size={16} />}
                {selectedGuests.size === guests.length ? 'Deselect All' : 'Select All'}
              </button>
              <span className="text-sm text-gray-500">
                {selectedCount} selected · {guests.length} total
              </span>
            </div>
            <div className="text-sm">
              <span className="font-medium">
                Cost: {totalCost === 0 ? 'Free' : `${totalCost} TZS`}
                <span className="text-xs text-gray-400 block">
                  <Info size={10} className="inline mr-0.5" />
                  First 2 reminders per guest are free
                </span>
              </span>
              {credits !== null && (
                <span className="text-gray-400 ml-2">(Available: {credits} TZS)</span>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
            <MessageSquare size={12} />
            Reminders are sent via SMS to all selected guests with a phone number.
          </p>
        </div>

        <div className="p-5">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <FileText size={15} />
              SMS Message
              <span className="text-gray-400 text-xs font-normal ml-1">
                (use {'{name}'} for guest name)
              </span>
            </label>
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent resize-none"
              placeholder="e.g. Habari {name}, tunakumbusha kuhusu michango yako kwa {event}. Asante."
            />
          </div>

          <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100">
            {guests.map((guest) => {
              const isWhatsApp = guest.routingChannel === 'whatsapp';
              return (
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-800">{guest.name}</p>
                      {isWhatsApp ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0D4B4B] bg-[rgba(13,75,75,0.07)] px-2 py-0.5 rounded-full">
                          <MessageCircle size={10} /> WhatsApp
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                          <Phone size={10} /> SMS
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{guest.phone}</p>
                  </div>
                  <div className="text-xs text-gray-400">
                    {guest.reminderCount < 2 ? (
                      <span className="text-[#0D4B4B] flex items-center gap-0.5">
                        <Sparkles size={10} /> Free
                      </span>
                    ) : (
                      <span>50 TZS</span>
                    )}
                    <span className="ml-2 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                      <Hash size={9} />
                      {guest.reminderCount} sent
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 flex gap-3">
            <button
              onClick={sendReminders}
              disabled={sending || alreadyUsed || selectedCount === 0 || !message.trim() || (totalCost > 0 && credits !== null && credits < totalCost)}
              className="flex-1 bg-gradient-to-r from-[#0D4B4B] to-[#0A3939] text-white py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={18} />}
              {sending ? 'Sending...' : `Send Reminder${selectedCount > 1 ? 's' : ''}`}
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
  );
}