'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Send, CheckCircle, XCircle, Clock, MessageCircle, Phone, Image as ImageIcon,
  ArrowLeft, Users, Sparkles, AlertCircle, Loader2, RefreshCw,
  ChevronDown, ChevronUp, Copy, Check, Filter,
  Smartphone, QrCode, Calendar, MapPin, User, Hash,
  FileText, Info, Eye, AlertTriangle, RotateCw, Edit3, EyeOff
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
  passCode?: string | null;
}

interface EventData {
  id: string;
  name: string;
  date: string;
  venue: string;
  address: string;
  tenant: { testMode: boolean };
  hostFamily?: string;
  person1?: string;
  person2?: string;
  time?: string;
}

interface SendResult {
  guestId: string;
  name: string;
  success: boolean;
  error?: string;
  channel?: string;
  messageId?: string;
}

interface TemplateVariables {
  guestName: string;
  hostFamily: string;
  person1: string;
  person2: string;
  date: string;
  venue: string;
  time: string;
  cardNumber: string;
  cardType: string;
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
  const [filterChannel, setFilterChannel] = useState<'all' | 'whatsapp' | 'sms'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'pending' | 'failed'>('all');
  const [expandedGuest, setExpandedGuest] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<'sms' | 'whatsapp'>('sms');
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [whatsappFailed, setWhatsappFailed] = useState<{ name: string; phone: string }[]>([]);

  // ─── Template Variables State ──────────────────────────────────────────
  const [smsVariables, setSmsVariables] = useState<TemplateVariables>({
    guestName: '',
    hostFamily: '',
    person1: '',
    person2: '',
    date: '',
    venue: '',
    time: '',
    cardNumber: '',
    cardType: '',
  });

  const [whatsappVariables, setWhatsappVariables] = useState<TemplateVariables>({
    guestName: '',
    hostFamily: '',
    person1: '',
    person2: '',
    date: '',
    venue: '',
    time: '',
    cardNumber: '',
    cardType: '',
  });

  // ─── Stats ──────────────────────────────────────────────────────────────
  const whatsappCount = guests.filter(g => g.routingChannel === 'whatsapp').length;
  const smsCount = guests.filter(g => g.routingChannel === 'sms').length;
  const sentCount = guests.filter(g => g.invitationSentAt).length;
  const hasCard = guests.some(g => g.invitationCard);
  const failedCount = results.filter(r => !r.success).length;
  const successCount = results.filter(r => r.success).length;
  const guestsWithoutPassCode = guests.filter(g => !g.passCode).length;

  // ─── Load Data ──────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoadingGuests(true);
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

      // Set default variables from event data
      const defaultVars: TemplateVariables = {
        guestName: '{Guest Name}',
        hostFamily: eventData.event?.hostFamily || '{Host Family}',
        person1: eventData.event?.person1 || '{Bride/Groom 1}',
        person2: eventData.event?.person2 || '{Bride/Groom 2}',
        date: eventData.event?.date ? new Date(eventData.event.date).toLocaleDateString('sw-TZ', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }) : '{Date}',
        venue: eventData.event?.venue || '{Venue}',
        time: eventData.event?.time || '{Time}',
        cardNumber: '{Card Number}',
        cardType: '{Card Type}',
      };

      setSmsVariables(defaultVars);
      setWhatsappVariables(defaultVars);
      setGuests(guestsData || []);
    } catch (error) {
      console.error('Load error:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
      setLoadingGuests(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [eventId]);

  // ─── Generate Cards ──────────────────────────────────────────────────
  const handleGenerateCards = async () => {
    const pendingGuests = guests.filter(g => !g.passCode);

    if (pendingGuests.length === 0) {
      toast.success('All guests already have cards');
      return;
    }

    setGeneratingCards(true);
    let currentToast = toast.loading(`Generating ${pendingGuests.length} cards...`);

    try {
      const res = await fetch('/api/invitations/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          guestIds: pendingGuests.map(g => g.id)
        }),
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok && data.completed > 0) {
        toast.success(`✅ ${data.completed} cards generated`, { id: currentToast });
        await loadData();
      } else {
        toast.error('Failed to generate cards', { id: currentToast });
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('Network error');
    } finally {
      setGeneratingCards(false);
    }
  };

  // ─── Helper: Build personalized message ──────────────────────────────
  const buildPersonalizedMessage = (variables: TemplateVariables, guest: Guest): string => {
    const fullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
    const cardNumber = guest.cardNumber || variables.cardNumber;

    let message = `Habari ${variables.guestName.replace('{Guest Name}', fullName)},

Familia ya ${variables.hostFamily} inapenda kukualika katika sherehe ya harusi ya ${variables.person1} na ${variables.person2} itakayofanyika tarehe ${variables.date}.

Reception itafanyika katika ukumbi wa ${variables.venue}, kuanzia saa ${variables.time}.

Card No: ${cardNumber} ${variables.cardType}

Tafadhali onyesha kadi hii wakati wa kuingia.
Karibu na ufurahie sherehe!

Ahsante.`;

    return message;
  };

  // ─── Get sample message preview ──────────────────────────────────────
  const getSamplePreview = (variables: TemplateVariables): string => {
    const sampleGuest: Guest = {
      id: 'sample',
      name: 'John Doe',
      title: 'Mr',
      phone: '+255712345678',
      routingChannel: 'sms',
      invitationCard: null,
      smsCode: null,
      qrToken: null,
      cardNumber: '00123',
      invitationSentAt: null,
      passCode: 'WED-8F92',
    };

    return buildPersonalizedMessage(variables, sampleGuest);
  };

  // ─── Broadcast to all guests ──────────────────────────────────────────
  const broadcast = async () => {
    const targetGuests = getFilteredGuests();
    if (targetGuests.length === 0) {
      toast.error('No guests matching the current filters');
      return;
    }

    // Check if any SMS guests need variables
    const smsGuests = targetGuests.filter(g => g.routingChannel === 'sms');
    if (smsGuests.length > 0) {
      const missingVars = Object.entries(smsVariables).filter(([key, value]) => !value || value.includes('{'));
      if (missingVars.length > 0) {
        toast.error('Please fill in all template variables for SMS');
        return;
      }
    }

    // Check if any WhatsApp guests need variables
    const whatsappGuests = targetGuests.filter(g => g.routingChannel === 'whatsapp');
    if (whatsappGuests.length > 0) {
      const missingVars = Object.entries(whatsappVariables).filter(([key, value]) => !value || value.includes('{'));
      if (missingVars.length > 0) {
        toast.error('Please fill in all template variables for WhatsApp');
        return;
      }
    }

    setSending(true);
    setResults([]);
    setWhatsappFailed([]);

    try {
      const guestIds = targetGuests.map(g => g.id);

      const res = await fetch('/api/invitations/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          guestIds,
          smsVariables,
          whatsappVariables,
        }),
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        setResults(data.results || []);

        // ─── Check for WhatsApp failures ──────────────────────────────
        const failedWhatsApp = data.results?.filter(
          (r: any) => r.channel === 'whatsapp' && !r.success
        ) || [];

        if (failedWhatsApp.length > 0) {
          setWhatsappFailed(
            failedWhatsApp.map((r: any) => ({
              name: r.name,
              phone: guests.find((g) => g.id === r.guestId)?.phone || '',
            }))
          );

          // ─── Show toast with failed numbers ──────────────────────────
          toast.custom(
            (t) => (
              <div
                className={`${
                  t.visible ? 'animate-enter' : 'animate-leave'
                } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex flex-col overflow-hidden border border-gray-200 max-h-[400px]`}
              >
                <div className="p-4 bg-amber-50 border-b border-amber-200">
                  <h3 className="font-semibold text-amber-800 flex items-center gap-2">
                    <AlertCircle size={18} />
                    WhatsApp Failed - Fallback to SMS
                  </h3>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                  <p className="text-sm text-gray-600 mb-3">
                    The following numbers don't have WhatsApp and will receive SMS instead:
                  </p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {failedWhatsApp.map((r: any) => (
                      <div key={r.guestId} className="text-sm text-gray-700 flex items-center gap-2">
                        <span className="font-medium">{r.name}</span>
                        <span className="text-gray-400 text-xs">
                          {guests.find((g) => g.id === r.guestId)?.phone}
                        </span>
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                          SMS
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-3">
                    These guests have been automatically switched to SMS for future sends.
                  </p>
                </div>
                <div className="p-3 border-t border-gray-100">
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="w-full bg-[#0D4F4F] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0A3D3D] transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ),
            { duration: 8000 }
          );
        }

        if (data.successCount === data.total) {
          toast.success(`✅ Sent to all ${data.total} guests`);
        } else if (data.successCount > 0) {
          toast(`${data.successCount} of ${data.total} guests received the message. ${data.failCount} failed.`, {
            icon: <AlertTriangle size={18} className="text-amber-500" />,
            duration: 5000,
          });
        } else {
          toast.error(`❌ Failed to send to any guests.`);
        }

        await loadData();
      } else {
        toast.error(data.error || 'Failed to send invitations');
      }
    } catch (error) {
      console.error('Broadcast error:', error);
      toast.error('Network error');
    } finally {
      setSending(false);
    }
  };

  // ─── Retry Failed Messages ────────────────────────────────────────────
  const retryFailed = async () => {
    const failedGuestIds = results
      .filter(r => !r.success)
      .map(r => r.guestId);

    if (failedGuestIds.length === 0) {
      toast('No failed messages to retry', {
        icon: <Info size={18} className="text-blue-500" />,
        duration: 3000,
      });
      return;
    }

    setRetrying(true);

    try {
      const res = await fetch('/api/invitations/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          guestIds: failedGuestIds,
          smsVariables,
          whatsappVariables,
          retry: true,
        }),
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        const newResults = results.map(r => {
          const updated = data.results?.find((ur: any) => ur.guestId === r.guestId);
          return updated || r;
        });
        setResults(newResults);

        toast.success(`Retried ${data.successCount} failed messages. ${data.failCount} still failed.`);
        await loadData();
      } else {
        toast.error(data.error || 'Failed to retry');
      }
    } catch (error) {
      console.error('Retry error:', error);
      toast.error('Network error');
    } finally {
      setRetrying(false);
    }
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

  // ─── Variable Input Component ──────────────────────────────────────────
  const VariableInput = ({
    label,
    value,
    onChange,
    placeholder,
    helpText,
  }: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    placeholder?: string;
    helpText?: string;
  }) => (
    <div>
      <label className="block text-xs font-medium text-gray-700 mb-0.5">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        className="w-full p-1.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
      />
      {helpText && <p className="text-[10px] text-gray-400 mt-0.5">{helpText}</p>}
    </div>
  );

  // ─── Loading state ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={32} className="animate-spin text-[#0D4F4F]" />
        <p className="text-sm text-gray-400">Loading invitations...</p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href={`/client/events/${eventId}`}
            className="text-gray-500 hover:text-[#0D4F4F] transition p-2 hover:bg-gray-100 rounded-xl"
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
            onClick={handleGenerateCards}
            disabled={generatingCards || guests.length === 0}
            className="px-4 py-2 bg-amber-600 text-white rounded-xl font-semibold text-sm hover:bg-amber-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            {generatingCards ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generatingCards ? 'Generating...' : `Cards (${guestsWithoutPassCode})`}
          </button>
          <button
            onClick={() => sendToChannel('whatsapp')}
            disabled={sending || whatsappCount === 0}
            className="px-4 py-2 bg-[#0D4F4F] text-white rounded-xl font-semibold text-sm hover:bg-[#0A3D3D] transition disabled:opacity-50 flex items-center gap-2"
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
          {failedCount > 0 && (
            <button
              onClick={retryFailed}
              disabled={retrying || sending}
              className="px-4 py-2 bg-red-600 text-white rounded-xl font-semibold text-sm hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {retrying ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
              Retry Failed ({failedCount})
            </button>
          )}
        </div>
      </div>

      {/* ─── Channel Toggle ─── */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveChannel('sms')}
          className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
            activeChannel === 'sms'
              ? 'bg-[#0D4F4F] text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Phone size={18} /> SMS Message
        </button>
        <button
          onClick={() => setActiveChannel('whatsapp')}
          className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-semibold transition flex items-center justify-center gap-2 ${
            activeChannel === 'whatsapp'
              ? 'bg-[#0D4F4F] text-white shadow-md'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <MessageCircle size={18} /> WhatsApp Message
        </button>
        <button
          onClick={() => setShowPreview(!showPreview)}
          className={`px-4 py-2.5 rounded-xl font-semibold transition flex items-center gap-2 ${
            showPreview
              ? 'bg-[#0D4F4F] text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
          title="Toggle preview"
        >
          {showPreview ? <EyeOff size={18} /> : <Eye size={18} />}
          {showPreview ? 'Hide Preview' : 'Show Preview'}
        </button>
      </div>

      {/* ─── SMS Editor ─── */}
      {activeChannel === 'sms' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={18} className="text-[#0D4F4F]" />
            <h2 className="font-semibold text-gray-800">SMS Message Template</h2>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Custom</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <VariableInput
              label="Guest Name"
              value={smsVariables.guestName}
              onChange={(val) => setSmsVariables({ ...smsVariables, guestName: val })}
              placeholder="e.g., Mr John Doe"
              helpText="Replaced with each guest's name"
            />
            <VariableInput
              label="Host Family"
              value={smsVariables.hostFamily}
              onChange={(val) => setSmsVariables({ ...smsVariables, hostFamily: val })}
              placeholder="e.g., Mr & Mrs Allan Swai"
            />
            <VariableInput
              label="Person 1"
              value={smsVariables.person1}
              onChange={(val) => setSmsVariables({ ...smsVariables, person1: val })}
              placeholder="e.g., Agape"
            />
            <VariableInput
              label="Person 2"
              value={smsVariables.person2}
              onChange={(val) => setSmsVariables({ ...smsVariables, person2: val })}
              placeholder="e.g., Gladness"
            />
            <VariableInput
              label="Date"
              value={smsVariables.date}
              onChange={(val) => setSmsVariables({ ...smsVariables, date: val })}
              placeholder="e.g., 15 Septemba, 2026"
            />
            <VariableInput
              label="Venue"
              value={smsVariables.venue}
              onChange={(val) => setSmsVariables({ ...smsVariables, venue: val })}
              placeholder="e.g., The Embassy Hall"
            />
            <VariableInput
              label="Time"
              value={smsVariables.time}
              onChange={(val) => setSmsVariables({ ...smsVariables, time: val })}
              placeholder="e.g., 5:00 PM"
            />
            <VariableInput
              label="Card Number"
              value={smsVariables.cardNumber}
              onChange={(val) => setSmsVariables({ ...smsVariables, cardNumber: val })}
              placeholder="e.g., 00123"
              helpText="Replaced with each guest's card number"
            />
            <VariableInput
              label="Card Type"
              value={smsVariables.cardType}
              onChange={(val) => setSmsVariables({ ...smsVariables, cardType: val })}
              placeholder="e.g., SINGLE or DOUBLE"
            />
          </div>

          {/* ─── SMS Preview ─── */}
          {showPreview && (
            <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2">
                  <Eye size={14} /> Message Preview
                </p>
                <span className="text-[10px] text-gray-400">Sample guest: Mr John Doe · Card: 00123</span>
              </div>
              <div className="bg-white rounded-lg p-3 text-sm text-gray-700 font-mono whitespace-pre-wrap border border-gray-100">
                {getSamplePreview(smsVariables)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── WhatsApp Editor ─── */}
      {activeChannel === 'whatsapp' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={18} className="text-green-600" />
            <h2 className="font-semibold text-gray-800">WhatsApp Message Template</h2>
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Template</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <VariableInput
              label="Guest Name"
              value={whatsappVariables.guestName}
              onChange={(val) => setWhatsappVariables({ ...whatsappVariables, guestName: val })}
              placeholder="e.g., Mr John Doe"
              helpText="Replaced with each guest's name"
            />
            <VariableInput
              label="Host Family"
              value={whatsappVariables.hostFamily}
              onChange={(val) => setWhatsappVariables({ ...whatsappVariables, hostFamily: val })}
              placeholder="e.g., Mr & Mrs Allan Swai"
            />
            <VariableInput
              label="Person 1"
              value={whatsappVariables.person1}
              onChange={(val) => setWhatsappVariables({ ...whatsappVariables, person1: val })}
              placeholder="e.g., Agape"
            />
            <VariableInput
              label="Person 2"
              value={whatsappVariables.person2}
              onChange={(val) => setWhatsappVariables({ ...whatsappVariables, person2: val })}
              placeholder="e.g., Gladness"
            />
            <VariableInput
              label="Date"
              value={whatsappVariables.date}
              onChange={(val) => setWhatsappVariables({ ...whatsappVariables, date: val })}
              placeholder="e.g., 15 Septemba, 2026"
            />
            <VariableInput
              label="Venue"
              value={whatsappVariables.venue}
              onChange={(val) => setWhatsappVariables({ ...whatsappVariables, venue: val })}
              placeholder="e.g., The Embassy Hall"
            />
            <VariableInput
              label="Time"
              value={whatsappVariables.time}
              onChange={(val) => setWhatsappVariables({ ...whatsappVariables, time: val })}
              placeholder="e.g., 5:00 PM"
            />
            <VariableInput
              label="Card Number"
              value={whatsappVariables.cardNumber}
              onChange={(val) => setWhatsappVariables({ ...whatsappVariables, cardNumber: val })}
              placeholder="e.g., 00123"
              helpText="Replaced with each guest's card number"
            />
            <VariableInput
              label="Card Type"
              value={whatsappVariables.cardType}
              onChange={(val) => setWhatsappVariables({ ...whatsappVariables, cardType: val })}
              placeholder="e.g., SINGLE or DOUBLE"
            />
          </div>

          {/* ─── WhatsApp Preview ─── */}
          {showPreview && (
            <div className="mt-4 p-4 bg-green-50 rounded-xl border border-green-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-green-700 uppercase tracking-wider flex items-center gap-2">
                  <Eye size={14} /> Message Preview
                </p>
                <span className="text-[10px] text-green-500">Sample guest: Mr John Doe · Card: 00123</span>
              </div>
              <div className="bg-white rounded-lg p-3 text-sm text-gray-700 font-mono whitespace-pre-wrap border border-green-100">
                {getSamplePreview(whatsappVariables)}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#0D4F4F]" />
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
                ? 'bg-[#0D4F4F] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterChannel('whatsapp')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-1 ${
              filterChannel === 'whatsapp'
                ? 'bg-[#0D4F4F] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <MessageCircle size={12} /> WhatsApp
          </button>
          <button
            onClick={() => setFilterChannel('sms')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition flex items-center gap-1 ${
              filterChannel === 'sms'
                ? 'bg-[#0D4F4F] text-white'
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
            <Users size={18} className="text-[#0D4F4F]" />
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
              disabled={sending || filteredGuests.length === 0 || loadingGuests}
              className="px-4 py-1.5 bg-[#0D4F4F] text-white rounded-lg text-sm font-semibold hover:bg-[#0A3D3D] transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Sending...' : 'Send All'}
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {loadingGuests ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#0D4F4F]" />
            </div>
          ) : filteredGuests.length === 0 ? (
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
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0D4F4F] to-[#0A3D3D] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
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
                        {guest.passCode && (
                          <span className="text-xs text-purple-600 font-mono bg-purple-50 px-2 py-0.5 rounded-full">
                            {guest.passCode}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                        {guest.phone && <span>{guest.phone}</span>}
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
                        {guest.passCode && (
                          <div className="flex items-center gap-2 text-sm">
                            <QrCode size={14} className="text-gray-400" />
                            <span className="text-gray-600 font-mono">{guest.passCode}</span>
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
                            <span>Checked In</span>
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
            <div className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded-lg max-h-32 overflow-y-auto">
              {results.filter(r => !r.success).map(r => (
                <div key={r.guestId}>• {r.name}: {r.error}</div>
              ))}
            </div>
          )}
          {results.filter(r => r.success).length > 0 && results.filter(r => !r.success).length > 0 && (
            <button
              onClick={retryFailed}
              disabled={retrying}
              className="mt-3 px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {retrying ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
              Retry Failed Messages
            </button>
          )}
        </div>
      )}

      {/* ─── WhatsApp Failed Toast ─── */}
      {whatsappFailed.length > 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-amber-600" />
            <p className="font-semibold text-amber-800 text-sm">WhatsApp Failed - Fallback to SMS</p>
          </div>
          <p className="text-xs text-amber-600 mb-2">
            The following guests were automatically switched to SMS:
          </p>
          <div className="flex flex-wrap gap-2">
            {whatsappFailed.map((guest, index) => (
              <span key={index} className="text-xs bg-white px-2 py-1 rounded-full border border-amber-200 text-gray-700">
                {guest.name} <span className="text-gray-400">{guest.phone}</span>
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}