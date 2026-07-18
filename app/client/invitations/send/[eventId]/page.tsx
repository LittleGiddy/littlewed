'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Copy, CheckCircle, XCircle, Loader2, AlertTriangle, MessageCircle, Phone, CheckSquare, Square, Trash2, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface Guest {
  id: string;
  name: string;
  phone: string;
  routingChannel: string;
  invitationCard: string | null;
  smsCode: string | null;
  invitationSentAt: string | null;
}

interface BroadcastResult {
  guestId: string;
  name: string;
  channel: string;
  success: boolean;
  error?: string;
}

export default function SendInvitationsPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<BroadcastResult[]>([]);
  const [eventCredits, setEventCredits] = useState<number | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [savingMessage, setSavingMessage] = useState(false);
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [sendingGuestId, setSendingGuestId] = useState<string | null>(null);
  const [deletingGuestId, setDeletingGuestId] = useState<string | null>(null);

  const COST_PER_GUEST = 300;

  // ─── Load data ────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const [guestsRes, eventRes, settingsRes, usageRes] = await Promise.all([
          fetch(`/api/events/${eventId}/guests`, { credentials: 'include' }),
          fetch(`/api/events/${eventId}`, { credentials: 'include' }),
          fetch(`/api/events/${eventId}/settings`, { credentials: 'include' }),
          fetch(`/api/events/${eventId}/usage`, { credentials: 'include' }),
        ]);

        const guestsData = await guestsRes.json();
        const eventData = await eventRes.json();
        const settingsData = await settingsRes.json();
        const usageData = await usageRes.json();

        const fixedGuests = guestsData.map((g: any) => ({ ...g, routingChannel: g.routingChannel || 'sms' }));
        setGuests(fixedGuests);
        setCustomMessage(settingsData.customMessage || '');

        const guestCount = eventData.event?.guestCount || 0;
        const allocated = guestCount * COST_PER_GUEST;
        const used = usageData.totalCost || 0;
        const remaining = Math.max(0, allocated - used);
        setEventCredits(remaining);

        setLoading(false);
      } catch (error) {
        console.error('Load error:', error);
        toast.error('Failed to load data');
        setLoading(false);
      }
    };

    if (eventId) loadData();
  }, [eventId]);

  // ─── Refresh credits ──────────────────────────────────────────────
  const refreshCredits = async () => {
    try {
      const [eventRes, usageRes] = await Promise.all([
        fetch(`/api/events/${eventId}`, { credentials: 'include' }),
        fetch(`/api/events/${eventId}/usage`, { credentials: 'include' }),
      ]);
      const eventData = await eventRes.json();
      const usageData = await usageRes.json();
      const guestCount = eventData.event?.guestCount || 0;
      const allocated = guestCount * COST_PER_GUEST;
      const used = usageData.totalCost || 0;
      const remaining = Math.max(0, allocated - used);
      setEventCredits(remaining);
    } catch {
      // silent
    }
  };

  // ─── Save custom message ──────────────────────────────────────────
  const saveCustomMessage = async () => {
    setSavingMessage(true);
    try {
      await fetch(`/api/events/${eventId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customMessage }),
        credentials: 'include',
      });
      toast.success('Message saved');
    } catch {
      toast.error('Failed to save message');
    } finally {
      setSavingMessage(false);
    }
  };

  // ─── Send helpers ──────────────────────────────────────────────────
  const sendGuests = async (guestList: Guest[], channelLabel: string) => {
    if (guestList.length === 0) {
      toast.error(`No ${channelLabel} guests to send.`);
      return;
    }
    const totalCost = guestList.length * COST_PER_GUEST;
    if (eventCredits !== null && eventCredits < totalCost) {
      toast.error(`Insufficient credits. Need ${totalCost} TZS, you have ${eventCredits} TZS.`);
      return;
    }

    await saveCustomMessage();
    if (!window.confirm(`Send invitations to ${guestList.length} ${channelLabel} guest${guestList.length > 1 ? 's' : ''}? This will cost ${totalCost} TZS.`)) return;

    setSending(true);
    let successCount = 0;
    for (const guest of guestList) {
      try {
        const res = await fetch('/api/invitations/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId: guest.id, eventId }),
          credentials: 'include',
        });
        const data = await res.json();
        if (res.ok) {
          successCount++;
          setResults(prev => [...prev, { guestId: guest.id, name: guest.name, channel: guest.routingChannel, success: true }]);
        } else {
          setResults(prev => [...prev, { guestId: guest.id, name: guest.name, channel: guest.routingChannel, success: false, error: data.error }]);
        }
      } catch {
        setResults(prev => [...prev, { guestId: guest.id, name: guest.name, channel: guest.routingChannel, success: false, error: 'Network error' }]);
      }
      await new Promise(r => setTimeout(r, 500));
    }

    await refreshCredits();
    toast.success(`Sent to ${successCount} of ${guestList.length} guests.`);
    setSending(false);
    // Deselect all
    setSelectedGuests(new Set());
  };

  // ─── Per‑guest send ──────────────────────────────────────────────
  const sendToGuest = async (guest: Guest) => {
    if (eventCredits !== null && eventCredits < COST_PER_GUEST) {
      toast.error(`Insufficient credits. Need ${COST_PER_GUEST} TZS, you have ${eventCredits} TZS.`);
      return;
    }
    if (guest.routingChannel === 'whatsapp' && !guest.invitationCard) {
      toast.error('QR card not generated yet.');
      return;
    }
    if (guest.routingChannel === 'sms' && !guest.smsCode) {
      toast.error('SMS code not generated yet.');
      return;
    }

    setSendingGuestId(guest.id);
    try {
      const res = await fetch('/api/invitations/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: guest.id, eventId }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Invitation sent to ${guest.name}`);
        setResults(prev => [...prev, { guestId: guest.id, name: guest.name, channel: guest.routingChannel, success: true }]);
        await refreshCredits();
      } else {
        toast.error(`Failed to send to ${guest.name}: ${data.error}`);
        setResults(prev => [...prev, { guestId: guest.id, name: guest.name, channel: guest.routingChannel, success: false, error: data.error }]);
      }
    } catch {
      toast.error(`Network error sending to ${guest.name}`);
    } finally {
      setSendingGuestId(null);
    }
  };

  // ─── Delete guest ──────────────────────────────────────────────────
  const deleteGuest = async (guestId: string) => {
    if (!confirm('Delete this guest?')) return;
    setDeletingGuestId(guestId);
    try {
      const res = await fetch(`/api/guests/${guestId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Guest deleted');
        setGuests(prev => prev.filter(g => g.id !== guestId));
        setSelectedGuests(prev => {
          const newSet = new Set(prev);
          newSet.delete(guestId);
          return newSet;
        });
        await refreshCredits();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeletingGuestId(null);
    }
  };

  // ─── Utility ──────────────────────────────────────────────────────
  const getGuestStatus = (guest: Guest) => {
    const result = results.find(r => r.guestId === guest.id);
    if (result) {
      return {
        text: result.success ? 'Sent' : (result.error || 'Failed'),
        icon: result.success ? <CheckCircle size={14} className="text-green-600" /> : <XCircle size={14} className="text-red-600" />
      };
    }
    if (guest.invitationSentAt) {
      return { text: 'Sent', icon: <CheckCircle size={14} className="text-green-600" /> };
    }
    if (guest.routingChannel === 'whatsapp') {
      return guest.invitationCard
        ? { text: 'QR ready', icon: null }
        : { text: 'No QR', icon: <AlertTriangle size={14} className="text-amber-600" /> };
    } else {
      return guest.smsCode
        ? { text: 'Code ready', icon: null }
        : { text: 'No code', icon: <AlertTriangle size={14} className="text-amber-600" /> };
    }
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/invite/${eventId}`;
    navigator.clipboard.writeText(link);
    toast.success('Invitation link copied!');
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="w-10 h-10 border-4 border-gray-200 border-t-[#0D4F4F] rounded-full animate-spin" /></div>;
  }

  const whatsappGuests = guests.filter(g => g.routingChannel === 'whatsapp' && g.phone);
  const smsGuests = guests.filter(g => g.routingChannel === 'sms' && g.phone);

  const toggleSelectAll = (channel: 'whatsapp' | 'sms') => {
    const list = channel === 'whatsapp' ? whatsappGuests : smsGuests;
    const allSelected = list.length > 0 && list.every(g => selectedGuests.has(g.id));
    if (allSelected) {
      setSelectedGuests(prev => {
        const newSet = new Set(prev);
        list.forEach(g => newSet.delete(g.id));
        return newSet;
      });
    } else {
      setSelectedGuests(prev => {
        const newSet = new Set(prev);
        list.forEach(g => newSet.add(g.id));
        return newSet;
      });
    }
  };

  const handleSendSelected = (channel: 'whatsapp' | 'sms') => {
    const list = channel === 'whatsapp' ? whatsappGuests : smsGuests;
    const selected = list.filter(g => selectedGuests.has(g.id));
    sendGuests(selected, channel === 'whatsapp' ? 'WhatsApp' : 'SMS');
  };

  const handleSendAll = (channel: 'whatsapp' | 'sms') => {
    const list = channel === 'whatsapp' ? whatsappGuests : smsGuests;
    sendGuests(list, channel === 'whatsapp' ? 'WhatsApp' : 'SMS');
  };

  // Guest row component
  const GuestRow = ({ guest }: { guest: Guest }) => {
    const status = getGuestStatus(guest);
    const isSending = sendingGuestId === guest.id;
    const isDeleting = deletingGuestId === guest.id;
    const isSelected = selectedGuests.has(guest.id);
    const isSent = guest.invitationSentAt !== null || status.text === 'Sent';
    const canSend = eventCredits !== null && eventCredits >= COST_PER_GUEST && !isSent && !isSending;
    const channelIcon = guest.routingChannel === 'whatsapp' ? <MessageCircle size={12} className="text-[#0D4F4F]" /> : <Phone size={12} className="text-gray-500" />;

    return (
      <div className="flex flex-col gap-2 p-3 hover:bg-gray-50 rounded-lg transition border-b border-gray-100 last:border-0">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              if (e.target.checked) {
                setSelectedGuests(prev => new Set(prev).add(guest.id));
              } else {
                setSelectedGuests(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(guest.id);
                  return newSet;
                });
              }
            }}
            className="w-4 h-4 rounded border-gray-300 text-[#0D4F4F] focus:ring-[#0D4F4F]"
          />
          <div className="w-8 h-8 rounded-full bg-[#0D4F4F] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
            {guest.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-800 truncate">{guest.name}</div>
            <div className="text-xs text-gray-500 flex items-center gap-1">
              {channelIcon} {guest.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
              {guest.phone && <span className="text-gray-400 ml-1">· {guest.phone}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {status.icon && <div className="flex-shrink-0">{status.icon}</div>}
            <span className="text-xs font-medium text-gray-600">{status.text}</span>
          </div>
        </div>

        {/* Message bubble */}
        <div className={`relative ml-11 max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${isSent ? 'bg-[#DCF8C6] self-start' : 'bg-gray-100 self-start'}`}>
          <div className="text-sm text-gray-800 whitespace-pre-wrap break-words">
            {customMessage || "You're invited!"}
          </div>
          {guest.invitationCard && guest.routingChannel === 'whatsapp' && (
            <div className="mt-2">
              <img
                src={guest.invitationCard}
                alt="Invitation Card"
                className="rounded-lg max-w-[180px] w-full border border-gray-200 shadow-sm"
              />
            </div>
          )}
          <div className="text-[10px] text-gray-400 mt-1 flex items-center gap-1">
            {isSent ? <CheckCircle size={12} className="text-green-600" /> : <Clock size={12} className="text-amber-500" />}
            {isSent ? 'Delivered' : 'Queued'}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-11 mt-1">
          <button
            onClick={() => sendToGuest(guest)}
            disabled={!canSend || (guest.routingChannel === 'whatsapp' && !guest.invitationCard) || (guest.routingChannel === 'sms' && !guest.smsCode)}
            className="text-xs font-medium text-[#0D4F4F] hover:underline disabled:opacity-50 flex items-center gap-1"
          >
            {isSending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            {isSending ? 'Sending...' : (guest.invitationSentAt ? 'Resend' : 'Send')}
          </button>
          <button
            onClick={() => deleteGuest(guest.id)}
            disabled={isDeleting}
            className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 flex items-center gap-1"
          >
            {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            Delete
          </button>
        </div>
      </div>
    );
  };

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4">
      <Link href={`/client/events/${eventId}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] rounded-xl px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.14)] mb-6">
        <ArrowLeft size={14} /> Back to Event
      </Link>

      <div className="flex justify-between items-start mb-6">
        <h1 className="font-serif text-3xl md:text-4xl font-black text-gray-900 leading-tight tracking-tight">Send Invitations</h1>
        <button onClick={copyInviteLink} className="flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] rounded-full px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.14)]">
          <Copy size={14} /> Copy link
        </button>
      </div>

      {/* Custom message */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Custom Invitation Message <span className="font-normal text-gray-400 text-xs">(applies to both WhatsApp and SMS)</span>
        </label>
        <textarea
          rows={3}
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          onBlur={saveCustomMessage}
          placeholder="e.g., Dear guest, we can't wait to celebrate with you!"
          className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent resize-none"
        />
        <div className="text-xs text-gray-400 mt-2 flex gap-4">
          <span>📱 WhatsApp: message + QR image</span>
          <span>📟 SMS: message + check‑in code</span>
        </div>
        {savingMessage && <p className="text-xs text-gray-400 mt-1">Saving...</p>}
      </div>

      {/* Credits */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Remaining Event Credits</p>
            <p className="font-serif text-3xl font-black text-[#0D4F4F]">{eventCredits?.toLocaleString() ?? '0'} TZS</p>
          </div>
          <div className="text-sm text-gray-400 text-right">
            <p>Each invitation costs <span className="font-semibold text-[#0D4F4F]">{COST_PER_GUEST}</span> TZS</p>
          </div>
        </div>
      </div>

      {/* Two‑column layout for WhatsApp & SMS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WhatsApp Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-[#EAF4F4] border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle size={18} className="text-[#0D4F4F]" />
              <h2 className="font-bold text-gray-800">WhatsApp</h2>
              <span className="text-xs bg-white px-2 py-0.5 rounded-full text-gray-600">{whatsappGuests.length} guests</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSendAll('whatsapp')}
                disabled={sending || whatsappGuests.length === 0}
                className="bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm hover:shadow-md disabled:opacity-50 transition flex items-center gap-1"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send All
              </button>
            </div>
          </div>
          <div className="p-3">
            <div className="flex justify-between items-center mb-3">
              <button
                onClick={() => toggleSelectAll('whatsapp')}
                className="text-xs text-gray-600 hover:text-[#0D4F4F] flex items-center gap-1"
              >
                {whatsappGuests.length > 0 && whatsappGuests.every(g => selectedGuests.has(g.id)) ? <CheckSquare size={14} /> : <Square size={14} />}
                {whatsappGuests.length > 0 && whatsappGuests.every(g => selectedGuests.has(g.id)) ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={() => handleSendSelected('whatsapp')}
                disabled={sending || !whatsappGuests.some(g => selectedGuests.has(g.id))}
                className="text-xs font-medium text-[#0D4F4F] hover:underline disabled:opacity-50 flex items-center gap-1"
              >
                <Send size={12} />
                Send Selected ({whatsappGuests.filter(g => selectedGuests.has(g.id)).length})
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
              {whatsappGuests.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-sm">No WhatsApp guests</div>
              ) : (
                whatsappGuests.map(guest => <GuestRow key={guest.id} guest={guest} />)
              )}
            </div>
          </div>
        </div>

        {/* SMS Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone size={18} className="text-gray-600" />
              <h2 className="font-bold text-gray-800">SMS</h2>
              <span className="text-xs bg-white px-2 py-0.5 rounded-full text-gray-600">{smsGuests.length} guests</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSendAll('sms')}
                disabled={sending || smsGuests.length === 0}
                className="bg-gradient-to-r from-gray-700 to-gray-800 text-white px-3 py-1.5 rounded-lg text-sm font-semibold shadow-sm hover:shadow-md disabled:opacity-50 transition flex items-center gap-1"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send All
              </button>
            </div>
          </div>
          <div className="p-3">
            <div className="flex justify-between items-center mb-3">
              <button
                onClick={() => toggleSelectAll('sms')}
                className="text-xs text-gray-600 hover:text-[#0D4F4F] flex items-center gap-1"
              >
                {smsGuests.length > 0 && smsGuests.every(g => selectedGuests.has(g.id)) ? <CheckSquare size={14} /> : <Square size={14} />}
                {smsGuests.length > 0 && smsGuests.every(g => selectedGuests.has(g.id)) ? 'Deselect All' : 'Select All'}
              </button>
              <button
                onClick={() => handleSendSelected('sms')}
                disabled={sending || !smsGuests.some(g => selectedGuests.has(g.id))}
                className="text-xs font-medium text-[#0D4F4F] hover:underline disabled:opacity-50 flex items-center gap-1"
              >
                <Send size={12} />
                Send Selected ({smsGuests.filter(g => selectedGuests.has(g.id)).length})
              </button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
              {smsGuests.length === 0 ? (
                <div className="py-6 text-center text-gray-400 text-sm">No SMS guests</div>
              ) : (
                smsGuests.map(guest => <GuestRow key={guest.id} guest={guest} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}