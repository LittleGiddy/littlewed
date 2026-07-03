'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send, Copy, CheckCircle, XCircle, Loader2, AlertTriangle, MessageCircle, Phone, CheckSquare, Square, Trash2, Image, Clock } from 'lucide-react';
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
  const [credits, setCredits] = useState<number | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [savingMessage, setSavingMessage] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'whatsapp' | 'sms' | 'all'>('whatsapp');
  const [sendingGuestId, setSendingGuestId] = useState<string | null>(null);
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [deletingGuestId, setDeletingGuestId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const COST_PER_GUEST = 300;

  useEffect(() => {
    Promise.all([
      fetch(`/api/events/${eventId}/guests`, { credentials: 'include' }).then(res => res.json()),
      fetch('/api/tenant/billing', { credentials: 'include' }).then(res => res.json()),
      fetch(`/api/events/${eventId}/settings`, { credentials: 'include' }).then(res => res.json()),
    ]).then(([guestsData, billingData, eventSettings]) => {
      const fixedGuests = guestsData.map((g: any) => ({ ...g, routingChannel: g.routingChannel || 'sms' }));
      setGuests(fixedGuests);
      setCredits(billingData.tenant?.credits ?? 0);
      setCustomMessage(eventSettings.customMessage || '');
      setLoading(false);
    }).catch(() => {
      toast.error('Failed to load data');
      setLoading(false);
    });
  }, [eventId]);

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

  const whatsappGuests = guests.filter(g => g.routingChannel === 'whatsapp' && g.phone);
  const smsGuests = guests.filter(g => g.routingChannel === 'sms' && g.phone);
  const allGuests = guests.filter(g => g.phone);

  const toggleSelectAll = () => {
    const currentList = activeFilter === 'whatsapp' ? whatsappGuests : smsGuests;
    const allSelected = currentList.length > 0 && currentList.every(g => selectedGuests.has(g.id));
    if (allSelected) {
      setSelectedGuests(prev => {
        const newSet = new Set(prev);
        currentList.forEach(g => newSet.delete(g.id));
        return newSet;
      });
    } else {
      setSelectedGuests(prev => {
        const newSet = new Set(prev);
        currentList.forEach(g => newSet.add(g.id));
        return newSet;
      });
    }
  };

  const sendSelected = async () => {
    const currentList = activeFilter === 'whatsapp' ? whatsappGuests : smsGuests;
    const selected = currentList.filter(g => selectedGuests.has(g.id));
    if (selected.length === 0) {
      toast.error(`No ${activeFilter === 'whatsapp' ? 'WhatsApp' : 'SMS'} guests selected.`);
      return;
    }
    const totalCost = selected.length * COST_PER_GUEST;
    if (credits !== null && credits < totalCost) {
      toast.error(`Insufficient credits. Need ${totalCost} TZS, you have ${credits} TZS.`);
      return;
    }
    await saveCustomMessage();
    if (!window.confirm(`Send invitations to ${selected.length} selected ${activeFilter === 'whatsapp' ? 'WhatsApp' : 'SMS'} guests? This will cost ${totalCost} TZS.`)) return;

    setSending(true);
    let successCount = 0;
    for (const guest of selected) {
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
          setResults(prev => [...prev, { guestId: guest.id, name: guest.name, channel: activeFilter, success: true }]);
        } else {
          setResults(prev => [...prev, { guestId: guest.id, name: guest.name, channel: activeFilter, success: false, error: data.error }]);
        }
      } catch {
        setResults(prev => [...prev, { guestId: guest.id, name: guest.name, channel: activeFilter, success: false, error: 'Network error' }]);
      }
      await new Promise(r => setTimeout(r, 500));
    }
    const billingRes = await fetch('/api/tenant/billing', { credentials: 'include' });
    const billingData = await billingRes.json();
    setCredits(billingData.tenant?.credits ?? 0);
    toast.success(`Sent to ${successCount} of ${selected.length} guests.`);
    setSending(false);
    setSelectedGuests(new Set());
  };

  const sendToGuest = async (guest: Guest) => {
    const cost = COST_PER_GUEST;
    if (credits !== null && credits < cost) {
      toast.error(`Insufficient credits. Need ${cost} TZS, you have ${credits} TZS.`);
      return;
    }
    if (guest.routingChannel === 'whatsapp' && !guest.invitationCard) {
      toast.error('QR card not generated yet. Generate QR codes first.');
      return;
    }
    if (guest.routingChannel === 'sms' && !guest.smsCode) {
      toast.error('SMS code not generated yet. Generate QR codes first.');
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
        const billingRes = await fetch('/api/tenant/billing', { credentials: 'include' });
        const billingData = await billingRes.json();
        setCredits(billingData.tenant?.credits ?? 0);
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

  const currentList = activeFilter === 'all' ? allGuests : (activeFilter === 'whatsapp' ? whatsappGuests : smsGuests);
  const totalPages = Math.ceil(currentList.length / itemsPerPage);
  const paginatedGuests = currentList.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="max-w-5xl mx-auto">
      <Link href={`/client/events/${eventId}`} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] rounded-xl px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.14)] mb-6">
        <ArrowLeft size={14} /> Back to Event
      </Link>

      <div className="flex justify-between items-start mb-6">
        <h1 className="font-serif text-3xl md:text-4xl font-black text-gray-900 leading-tight tracking-tight">Send Invitations</h1>
        <button onClick={copyInviteLink} className="flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] rounded-full px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.14)]">
          <Copy size={14} /> Copy link
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">Custom Invitation Message (optional)</label>
        <textarea rows={3} value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} onBlur={saveCustomMessage}
          placeholder="e.g., Dear guest, we can't wait to celebrate with you! Scan the QR code at the entrance."
          className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent resize-none" />
        {savingMessage && <p className="text-xs text-gray-400 mt-1">Saving...</p>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Available Credits</p>
            <p className="font-serif text-3xl font-black text-[#0D4F4F]">{credits?.toLocaleString() ?? '?'} TZS</p>
          </div>
          <div className="text-sm text-gray-400 text-right">
            <p>Each guest costs <span className="font-semibold text-[#0D4F4F]">{COST_PER_GUEST}</span> TZS</p>
            <p className="text-xs">Remaining credits update after each send</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b mb-4">
        {(['whatsapp', 'sms', 'all'] as const).map(filter => (
          <button key={filter} onClick={() => { setActiveFilter(filter); setCurrentPage(1); setSelectedGuests(new Set()); }} className={`px-4 py-2 text-sm font-medium transition-colors ${activeFilter === filter ? 'text-[#0D4F4F] border-b-2 border-[#0D4F4F]' : 'text-gray-500'}`}>
            {filter === 'all' ? 'All Guests' : filter === 'whatsapp' ? 'WhatsApp' : 'SMS'} ({filter === 'all' ? allGuests.length : filter === 'whatsapp' ? whatsappGuests.length : smsGuests.length})
          </button>
        ))}
      </div>

      {(activeFilter === 'whatsapp' || activeFilter === 'sms') && currentList.length > 0 && (
        <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded-lg">
          <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-gray-700">
            {currentList.length > 0 && currentList.every(g => selectedGuests.has(g.id)) ? <CheckSquare size={18} /> : <Square size={18} />}
            {currentList.length > 0 && currentList.every(g => selectedGuests.has(g.id)) ? 'Deselect All' : 'Select All'}
          </button>
          <button
            onClick={sendSelected}
            disabled={sending || selectedGuests.size === 0}
            className="bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white px-4 py-1.5 rounded-lg font-semibold shadow-md hover:shadow-lg disabled:opacity-50 transition flex items-center gap-2"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            Send Selected ({selectedGuests.size})
          </button>
        </div>
      )}

      {/* Chat-like guest list */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto p-4 space-y-4">
          {paginatedGuests.map(guest => {
            const status = getGuestStatus(guest);
            const isSending = sendingGuestId === guest.id;
            const isDeleting = deletingGuestId === guest.id;
            const isSelected = selectedGuests.has(guest.id);
            const showActions = activeFilter !== 'all';
            const isSent = guest.invitationSentAt !== null || status.text === 'Sent';
            const channelIcon = guest.routingChannel === 'whatsapp' ? <MessageCircle size={12} className="text-[#0D4F4F]" /> : <Phone size={12} className="text-gray-500" />;

            return (
              <div key={guest.id} className="flex flex-col gap-2">
                {/* Guest header with avatar, name, channel, and selection checkbox */}
                <div className="flex items-center gap-3">
                  {showActions && (
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
                  )}
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
                    {customMessage || "You're invited! Scan the QR code at the entrance."}
                  </div>
                  {guest.invitationCard && (
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
                {showActions && (
                  <div className="flex items-center gap-2 ml-11 mt-1">
                    <button
                      onClick={() => sendToGuest(guest)}
                      disabled={isSending || (guest.routingChannel === 'whatsapp' && !guest.invitationCard) || (guest.routingChannel === 'sms' && !guest.smsCode) || (credits !== null && credits < COST_PER_GUEST)}
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
                )}
              </div>
            );
          })}
          {currentList.length === 0 && <div className="py-12 text-center text-gray-500">No guests found in this category.</div>}
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded disabled:opacity-50">Previous</button>
          <span className="px-3 py-1">Page {currentPage} of {totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
        </div>
      )}
    </div>
  );
}