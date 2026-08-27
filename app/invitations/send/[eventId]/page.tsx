'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Send, CheckCircle, XCircle, Clock, MessageCircle, Phone, Image as ImageIcon,
  ArrowLeft, Users, Sparkles, AlertCircle, Loader2, RefreshCw, 
  Eye, EyeOff, ChevronDown, ChevronUp, Copy, Check, Filter,
  Smartphone, QrCode, Calendar, MapPin, User, Hash,
  FileText // ✅ Added FileText
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Guest {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  routingChannel: string;
  invitationCard: string | null;
  smsCode: string | null;
  qrToken: string | null;
  cardNumber: string | null;
  invitationSentAt: string | null;
  whatsappDetected?: boolean;
  checkedIn?: boolean;
}

interface EventData {
  id: string;
  name: string;
  date: string;
  venue: string;
  address: string;
  tenant: { testMode: boolean };
}

interface SendResult {
  guestId: string;
  name: string;
  success: boolean;
  error?: string;
  channel?: string;
}

export default function SendInvitationsPage() {
  const { eventId } = useParams();
  const router = useRouter();
  
  // ─── State ──────────────────────────────────────────────────────────────
  const [event, setEvent] = useState<EventData | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<SendResult[]>([]);
  const [customMessage, setCustomMessage] = useState('');
  const [filterChannel, setFilterChannel] = useState<'all' | 'whatsapp' | 'sms'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'pending' | 'failed'>('all');
  const [expandedGuest, setExpandedGuest] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(true);

  // ─── Stats ──────────────────────────────────────────────────────────────
  const whatsappCount = guests.filter(g => g.routingChannel === 'whatsapp').length;
  const smsCount = guests.filter(g => g.routingChannel === 'sms').length;
  const sentCount = guests.filter(g => g.invitationSentAt).length;
  const hasCard = guests.some(g => g.invitationCard);
  const failedCount = results.filter(r => !r.success).length;
  const successCount = results.filter(r => r.success).length;

  // ─── Load Data ──────────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const [eventRes, guestsRes, settingsRes] = await Promise.all([
          fetch(`/api/events/${eventId}`, { credentials: 'include' }),
          fetch(`/api/events/${eventId}/guests`, { credentials: 'include' }),
          fetch(`/api/events/${eventId}/settings`, { credentials: 'include' }),
        ]);

        const eventData = await eventRes.json();
        const guestsData = await guestsRes.json();
        const settings = await settingsRes.json();

        setEvent(eventData.event || eventData);
        setGuests(guestsData || []);
        setCustomMessage(settings.customMessage || "Hello {fullName}, you're invited to {event}! Scan the QR code at the entrance.");
      } catch (error) {
        console.error('Load error:', error);
        toast.error('Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [eventId]);

  // ─── Helper: Replace placeholders in SMS message ──────────────────────
  const personalizeMessage = (message: string, guest: Guest, event: EventData): string => {
    const fullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
    const formattedDate = new Date(event.date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return message
      .replace(/{title}/g, guest.title || 'Mr')
      .replace(/{name}/g, guest.name)
      .replace(/{fullName}/g, fullName)
      .replace(/{cardNumber}/g, guest.cardNumber || 'N/A')
      .replace(/{smsCode}/g, guest.smsCode || 'N/A')
      .replace(/{event}/g, event.name)
      .replace(/{date}/g, formattedDate)
      .replace(/{venue}/g, event.venue)
      .replace(/{address}/g, event.address || '');
  };

  // ─── Send to a single guest ────────────────────────────────────────────
  const sendToGuest = async (guest: Guest): Promise<SendResult> => {
    try {
      let endpoint: string;
      let body: any;

      if (guest.routingChannel === 'whatsapp') {
        // ✅ WhatsApp: Use template, NOT custom message
        endpoint = '/api/invitations/send-template';
        body = { 
          guestId: guest.id, 
          eventId,
          // WhatsApp uses template, not custom message
        };
      } else {
        // ✅ SMS: Use custom message with placeholders
        endpoint = '/api/invitations/send-sms';
        const personalizedMessage = personalizeMessage(customMessage, guest, event!);
        body = { 
          guestId: guest.id, 
          eventId,
          message: personalizedMessage,
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      
      const data = await res.json();
      return { 
        success: res.ok, 
        error: data.error,
        channel: guest.routingChannel,
        guestId: guest.id,
        name: guest.name,
      };
    } catch {
      return { 
        success: false, 
        error: 'Network error',
        channel: guest.routingChannel,
        guestId: guest.id,
        name: guest.name,
      };
    }
  };

  // ─── Broadcast to all guests ────────────────────────────────────────────
  const broadcast = async () => {
    const targetGuests = getFilteredGuests();
    if (targetGuests.length === 0) {
      toast.error('No guests matching the current filters');
      return;
    }

    setSending(true);
    setResults([]);
    let successCount = 0;
    const newResults: SendResult[] = [];

    for (const guest of targetGuests) {
      const result = await sendToGuest(guest);
      newResults.push(result);
      if (result.success) successCount++;
      setResults([...newResults]);
      await new Promise(r => setTimeout(r, 300));
    }

    toast.success(`Sent to ${successCount} of ${targetGuests.length} guests`);
    setSending(false);
    
    // Refresh guest list to update sent statuses
    const guestsRes = await fetch(`/api/events/${eventId}/guests`, { credentials: 'include' });
    const guestsData = await guestsRes.json();
    setGuests(guestsData);
  };

  // ─── Send to specific channel ──────────────────────────────────────────
  const sendToChannel = async (channel: 'whatsapp' | 'sms') => {
    const targetGuests = guests.filter(g => g.routingChannel === channel);
    if (targetGuests.length === 0) {
      toast.error(`No ${channel} guests found`);
      return;
    }
    setFilterChannel(channel);
    await broadcast();
  };

  // ─── Filter guests ──────────────────────────────────────────────────────
  const getFilteredGuests = useCallback(() => {
    let filtered = guests;
    
    if (filterChannel !== 'all') {
      filtered = filtered.filter(g => g.routingChannel === filterChannel);
    }
    
    if (filterStatus === 'sent') {
      filtered = filtered.filter(g => g.invitationSentAt);
    } else if (filterStatus === 'pending') {
      filtered = filtered.filter(g => !g.invitationSentAt);
    } else if (filterStatus === 'failed') {
      const failedIds = new Set(results.filter(r => !r.success).map(r => r.guestId));
      filtered = filtered.filter(g => failedIds.has(g.id));
    }
    
    return filtered;
  }, [guests, filterChannel, filterStatus, results]);

  const filteredGuests = getFilteredGuests();

  // ─── Get guest status ──────────────────────────────────────────────────
  const getGuestStatus = (guest: Guest): 'sent' | 'pending' | 'failed' => {
    const result = results.find(r => r.guestId === guest.id);
    if (result) {
      return result.success ? 'sent' : 'failed';
    }
    if (guest.invitationSentAt) return 'sent';
    return 'pending';
  };

  const getFullName = (guest: Guest) => {
    return guest.title ? `${guest.title} ${guest.name}` : guest.name;
  };

  // ─── Copy to clipboard ─────────────────────────────────────────────────
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // ─── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#0D4B4B] rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/client/events/${eventId}`}
            className="text-gray-500 hover:text-[#0D4B4B] transition p-2 hover:bg-gray-100 rounded-xl"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="font-serif text-3xl font-black text-gray-900">Send Invitations</h1>
            <p className="text-gray-500 text-sm">
              {event?.name} · {guests.length} guests
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => sendToChannel('whatsapp')}
            disabled={sending || whatsappCount === 0}
            className="px-4 py-2 bg-[#0D4B4B] text-white rounded-xl font-semibold text-sm hover:bg-[#0A3939] transition disabled:opacity-50 flex items-center gap-2"
          >
            <MessageCircle size={16} />
            WhatsApp ({whatsappCount})
          </button>
          <button
            onClick={() => sendToChannel('sms')}
            disabled={sending || smsCount === 0}
            className="px-4 py-2 bg-gray-700 text-white rounded-xl font-semibold text-sm hover:bg-gray-800 transition disabled:opacity-50 flex items-center gap-2"
          >
            <Phone size={16} />
            SMS ({smsCount})
          </button>
        </div>
      </div>

      {/* ─── SMS Message Editor ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
          <FileText size={18} className="text-[#0D4B4B]" />
          SMS Message Template
        </h2>
        <p className="text-xs text-gray-400 mb-3">
          This message is used for <strong>SMS</strong> only. WhatsApp uses a pre-approved template.
          <br />
          Available placeholders: <code className="bg-gray-100 px-1 rounded">{'{fullName}'}</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">{'{event}'}</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">{'{date}'}</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">{'{venue}'}</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">{'{cardNumber}'}</code>,{' '}
          <code className="bg-gray-100 px-1 rounded">{'{smsCode}'}</code>
        </p>
        <textarea
          value={customMessage}
          onChange={(e) => setCustomMessage(e.target.value)}
          rows={3}
          className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent resize-none text-sm"
          placeholder="Write your SMS message here... Use placeholders to personalize for each guest."
        />
        <div className="flex justify-between items-center mt-2 text-xs text-gray-400">
          <span>{customMessage.length} characters</span>
          <span className="text-[#0D4B4B] font-medium">
            {customMessage.includes('{fullName}') ? '✅ Personalized' : '⚠️ No {fullName} placeholder'}
          </span>
        </div>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#0D4B4B]" />
            <span className="text-sm font-medium text-gray-600">Total</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{guests.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <MessageCircle size={16} className="text-green-600" />
            <span className="text-sm font-medium text-gray-600">WhatsApp</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{whatsappCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-green-600" />
            <span className="text-sm font-medium text-gray-600">Sent</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{sentCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <ImageIcon size={16} className="text-amber-600" />
            <span className="text-sm font-medium text-gray-600">With Card</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{guests.filter(g => g.invitationCard).length}</p>
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-2">
          <button
            onClick={() => setFilterChannel('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filterChannel === 'all' 
                ? 'bg-[#0D4B4B] text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterChannel('whatsapp')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-1 ${
              filterChannel === 'whatsapp' 
                ? 'bg-[#0D4B4B] text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <MessageCircle size={12} /> WhatsApp
          </button>
          <button
            onClick={() => setFilterChannel('sms')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-1 ${
              filterChannel === 'sms' 
                ? 'bg-[#0D4B4B] text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Phone size={12} /> SMS
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filterStatus === 'all' 
                ? 'bg-gray-700 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All Status
          </button>
          <button
            onClick={() => setFilterStatus('sent')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filterStatus === 'sent' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <CheckCircle size={12} /> Sent
          </button>
          <button
            onClick={() => setFilterStatus('pending')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
              filterStatus === 'pending' 
                ? 'bg-amber-500 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Clock size={12} /> Pending
          </button>
          {failedCount > 0 && (
            <button
              onClick={() => setFilterStatus('failed')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                filterStatus === 'failed' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <XCircle size={12} /> Failed ({failedCount})
            </button>
          )}
        </div>
        <button
          onClick={() => {
            setFilterChannel('all');
            setFilterStatus('all');
          }}
          className="text-sm text-gray-400 hover:text-gray-600 transition"
        >
          Clear Filters
        </button>
      </div>

      {/* ─── Guest List ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users size={18} className="text-[#0D4B4B]" />
            <span className="font-semibold text-gray-800">
              {filteredGuests.length} guest{filteredGuests.length !== 1 ? 's' : ''}
            </span>
            {filterChannel !== 'all' && (
              <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                {filterChannel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">
              {successCount} sent · {failedCount} failed
            </span>
            <button
              onClick={broadcast}
              disabled={sending || filteredGuests.length === 0}
              className="px-4 py-1.5 bg-[#0D4B4B] text-white rounded-lg text-sm font-semibold hover:bg-[#0A3939] transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Sending...' : 'Send All'}
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {filteredGuests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users size={48} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No guests match your filters</p>
              <p className="text-sm text-gray-400">Try adjusting your filters or add guests first</p>
            </div>
          ) : (
            filteredGuests.map((guest) => {
              const status = getGuestStatus(guest);
              const isExpanded = expandedGuest === guest.id;
              const isWhatsApp = guest.routingChannel === 'whatsapp';
              const fullName = getFullName(guest);

              return (
                <div
                  key={guest.id}
                  className={`px-5 py-3 hover:bg-gray-50 transition cursor-pointer ${
                    status === 'sent' ? 'bg-green-50/30' : ''
                  } ${status === 'failed' ? 'bg-red-50/30' : ''}`}
                  onClick={() => setExpandedGuest(isExpanded ? null : guest.id)}
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0D4B4B] to-[#0A3939] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                      {guest.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-gray-900 truncate">{fullName}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                          isWhatsApp 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isWhatsApp ? <MessageCircle size={10} /> : <Phone size={10} />}
                          {isWhatsApp ? 'WhatsApp' : 'SMS'}
                        </span>
                        {guest.cardNumber && (
                          <span className="text-xs text-gray-400 font-mono">#{guest.cardNumber}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        {guest.phone && <span>{guest.phone}</span>}
                        {guest.smsCode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              copyToClipboard(guest.smsCode!, guest.id);
                            }}
                            className="flex items-center gap-1 hover:text-[#0D4B4B] transition"
                          >
                            <Hash size={10} />
                            {guest.smsCode}
                            {copiedCode === guest.id ? (
                              <Check size={10} className="text-green-600" />
                            ) : (
                              <Copy size={10} />
                            )}
                          </button>
                        )}
                        {guest.invitationSentAt && (
                          <span className="text-green-600 flex items-center gap-1">
                            <CheckCircle size={10} />
                            Sent {new Date(guest.invitationSentAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {status === 'sent' && <CheckCircle size={18} className="text-green-600" />}
                      {status === 'pending' && <Clock size={18} className="text-amber-500" />}
                      {status === 'failed' && <XCircle size={18} className="text-red-500" />}
                    </div>

                    {/* Expand */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedGuest(isExpanded ? null : guest.id);
                      }}
                      className="p-1 hover:bg-gray-200 rounded-lg transition text-gray-400"
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>

                  {/* ─── Expanded Content ─── */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {guest.invitationCard && (
                        <div className="bg-gray-50 rounded-xl p-3 text-center">
                          <p className="text-xs text-gray-500 mb-2">Invitation Card</p>
                          <img
                            src={guest.invitationCard}
                            alt="Card"
                            className="max-w-[120px] max-h-[160px] mx-auto rounded-lg shadow-sm object-contain"
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <User size={14} className="text-gray-400" />
                          <span className="text-gray-600">{fullName}</span>
                        </div>
                        {guest.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone size={14} className="text-gray-400" />
                            <span className="text-gray-600">{guest.phone}</span>
                          </div>
                        )}
                        {guest.cardNumber && (
                          <div className="flex items-center gap-2 text-sm">
                            <Hash size={14} className="text-gray-400" />
                            <span className="text-gray-600 font-mono">{guest.cardNumber}</span>
                          </div>
                        )}
                        {guest.smsCode && (
                          <div className="flex items-center gap-2 text-sm">
                            <QrCode size={14} className="text-gray-400" />
                            <span className="text-gray-600 font-mono">{guest.smsCode}</span>
                          </div>
                        )}
                        {guest.invitationSentAt && (
                          <div className="flex items-center gap-2 text-sm text-green-600">
                            <CheckCircle size={14} />
                            <span>Sent {new Date(guest.invitationSentAt).toLocaleString()}</span>
                          </div>
                        )}
                        {guest.checkedIn && (
                          <div className="flex items-center gap-2 text-sm text-blue-600">
                            <CheckCircle size={14} />
                            <span>Checked In ✅</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ─── Broadcast Results ─── */}
      {results.length > 0 && (
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Broadcast Results</p>
            <button
              onClick={() => setResults([])}
              className="text-xs text-gray-400 hover:text-gray-600 transition"
            >
              Clear
            </button>
          </div>
          <div className="flex gap-6 text-sm mt-2">
            <span className="text-green-600 flex items-center gap-1">
              <CheckCircle size={14} /> {results.filter(r => r.success).length} sent
            </span>
            <span className="text-red-500 flex items-center gap-1">
              <XCircle size={14} /> {results.filter(r => !r.success).length} failed
            </span>
            <span className="text-gray-400">
              {results.filter(r => r.channel === 'whatsapp').length} WhatsApp · 
              {results.filter(r => r.channel === 'sms').length} SMS
            </span>
          </div>
          {results.filter(r => !r.success).length > 0 && (
            <div className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded-lg">
              {results.filter(r => !r.success).map(r => (
                <div key={r.guestId}>{r.name}: {r.error}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}