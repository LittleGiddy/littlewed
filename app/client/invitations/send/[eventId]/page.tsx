'use client';

import { CardViewerModal } from '@/components/CardViewerModal';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Send, CheckCircle, XCircle, Clock, MessageCircle, Phone, Image as ImageIcon,
  ArrowLeft, Users, Sparkles, AlertCircle, Loader2, RefreshCw,
  ChevronDown, ChevronUp, Copy, Check, Filter, CheckSquare,
  Smartphone, QrCode, Calendar, MapPin, User, Hash,
  FileText, Info, Eye, AlertTriangle, RotateCw, EyeOff, Zap,
  HelpCircle, Edit3, Send as SendIcon, Globe, Lock, Save, MousePointerClick
} from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';

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
  passCode?: string | null;
  checkedIn?: boolean;
  guestType?: string | null;
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

// ─── SMS Template Default ───────────────────────────────────────────────
const DEFAULT_SMS_TEMPLATE = `Habari {guestName},

Familia ya {hostFamily} inakualika katika sherehe ya harusi ya {person1} na {person2} itakayofanyika tarehe {eventDate}.

Reception: {venue}, saa {time}

Card No: {cardNumber} {guestType}

Tafadhali onyesha kadi hii wakati wa kuingia.
Karibu sana!`;

// ─── Available Variables ────────────────────────────────────────────────
const SMS_VARIABLES = [
  { key: '{guestName}', label: 'Guest Full Name', example: 'Mr John Doe' },
  { key: '{guestTitle}', label: 'Guest Title', example: 'Mr' },
  { key: '{cardNumber}', label: 'Card Number', example: '00123' },
  { key: '{guestType}', label: 'Guest Type', example: 'Single / Double' },
  { key: '{hostFamily}', label: 'Host Family', example: 'Mr & Mrs Allan Swai' },
  { key: '{person1}', label: 'Person 1', example: 'Agape' },
  { key: '{person2}', label: 'Person 2', example: 'Gladness' },
  { key: '{eventDate}', label: 'Event Date', example: '15 Septemba, 2026' },
  { key: '{venue}', label: 'Venue', example: 'The Embassy Hall' },
  { key: '{time}', label: 'Event Time', example: '5:00 PM' },
];

// ─── SMS Variables Form Fields ──────────────────────────────────────────
const SMS_FIELD_LABELS: Record<string, string> = {
  hostFamily: 'Host Family',
  person1: 'Person 1 (e.g., Agape)',
  person2: 'Person 2 (e.g., Gladness)',
  eventDate: 'Event Date',
  venue: 'Venue',
  time: 'Event Time',
};

// ─── Approved Invitation Templates ─────────────────────────────────────
// Each template maps to a WhatsApp (pre-approved) template name plus the
// corresponding SMS body. `hasContact` adds the var10 / {contact} variable.
const INVITE_TEMPLATES: Record<
  string,
  { label: string; whatsappName: string; hasContact: boolean; smsBody: string }
> = {
  mwaliko: {
    label: 'Mwaliko',
    whatsappName: 'Mwalikotemp',
    hasContact: false,
    smsBody: `Habari {guestName},

Familia ya {hostFamily} inakualika katika sherehe ya harusi ya {person1} na {person2} itakayofanyika tarehe {eventDate}.

Reception: {venue}, saa {time}

Card No: {cardNumber} {guestType}

Tafadhali onyesha kadi hii wakati wa kuingia.
Karibu sana!`,
  },
  mwalikosecond: {
    label: 'Mwalikosecond',
    whatsappName: 'Mwalikosecond',
    hasContact: true,
    smsBody: `Habari {guestName}
Familia ya {hostFamily} inakualika katika sherehe ya harusi ya {person1} na {person2} itakayofanyika tarehe {eventDate}
Reception itafanyika {venue} kuanzia saa {time}
Card No: {cardNumber} {guestType}
kwa mawasiliano zaidi: {contact}
Tafadhali hakikisha unatunza kadi hii kwaajili ya matumizi ya ukumbini. Ahsante`,
  },
};

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
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [generatingCards, setGeneratingCards] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [whatsappFailed, setWhatsappFailed] = useState<{ name: string; phone: string }[]>([]);
  const [switchingChannel, setSwitchingChannel] = useState<string | null>(null);
  const [switchingAll, setSwitchingAll] = useState(false);
  const [genProgress, setGenProgress] = useState<{ done: number; total: number } | null>(null);
  const [cardGenErrors, setCardGenErrors] = useState<{ name: string; error: string }[]>([]);
  const [selectedCard, setSelectedCard] = useState<{ url: string; name: string; cardNumber?: string } | null>(null);

  // ─── Selection for "send to selected guests" ─────────────────────────
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [selecting, setSelecting] = useState(false);

  // ─── SMS State ────────────────────────────────────────────────────────
  const [smsVariables, setSmsVariables] = useState<Record<string, string>>({
    hostFamily: '',
    person1: '',
    person2: '',
    eventDate: '',
    venue: '',
    time: '',
  });
  const [smsTemplate, setSmsTemplate] = useState(DEFAULT_SMS_TEMPLATE);
  const [showVariables, setShowVariables] = useState(false);
  const [isSmsSaving, setIsSmsSaving] = useState(false);

  // ─── Template picker + contact info (var10) ─────────────────────────
  const [selectedTemplate, setSelectedTemplate] = useState<string>('mwaliko');
  const [contactInfo, setContactInfo] = useState('');

  // ─── WhatsApp Variables ──────────────────────────────────────────────
  const [whatsappVariables, setWhatsappVariables] = useState<Record<string, string>>({});
  const [isWhatsappSaving, setIsWhatsappSaving] = useState(false);

  // ─── Stats ──────────────────────────────────────────────────────────────
  const whatsappCount = guests.filter(g => g.routingChannel === 'whatsapp').length;
  const smsCount = guests.filter(g => g.routingChannel === 'sms').length;
  const sentCount = guests.filter(g => g.invitationSentAt).length;
  const failedCount = results.filter(r => !r.success).length;
  const successCount = results.filter(r => r.success).length;
  const guestsWithoutPassCode = guests.filter(g => !g.passCode).length;

  // ─── Auto-save SMS to localStorage ────────────────────────────────────
  const saveSmsState = useCallback(() => {
    try {
      const state = {
        template: smsTemplate,
        variables: smsVariables,
      };
      localStorage.setItem(`sms_template_${eventId}`, JSON.stringify(state));
    } catch (error) {
      // Ignore localStorage errors
    }
  }, [smsTemplate, smsVariables, eventId]);

  const loadSmsState = useCallback(() => {
    try {
      const saved = localStorage.getItem(`sms_template_${eventId}`);
      if (saved) {
        const state = JSON.parse(saved);
        if (state.template) setSmsTemplate(state.template);
        if (state.variables) setSmsVariables(state.variables);
        return true;
      }
    } catch (error) {
      // Ignore localStorage errors
    }
    return false;
  }, [eventId]);

  // ─── Auto-save WhatsApp to localStorage ──────────────────────────────
  const saveWhatsappState = useCallback(() => {
    try {
      localStorage.setItem(`whatsapp_variables_${eventId}`, JSON.stringify(whatsappVariables));
    } catch (error) {
      // Ignore localStorage errors
    }
  }, [whatsappVariables, eventId]);

  const loadWhatsappState = useCallback(() => {
    try {
      const saved = localStorage.getItem(`whatsapp_variables_${eventId}`);
      if (saved) {
        const state = JSON.parse(saved);
        setWhatsappVariables(state);
        return true;
      }
    } catch (error) {
      // Ignore localStorage errors
    }
    return false;
  }, [eventId]);

  // ─── Auto-save on change ─────────────────────────────────────────────
  useEffect(() => {
    if (!loading && eventId) {
      saveSmsState();
    }
  }, [smsTemplate, smsVariables, saveSmsState, loading, eventId]);

  useEffect(() => {
    if (!loading && eventId) {
      saveWhatsappState();
    }
  }, [whatsappVariables, saveWhatsappState, loading, eventId]);

  // ─── Load Data ──────────────────────────────────────────────────────────
  const loadData = async () => {
    setLoadingGuests(true);
    try {
      const [eventRes, guestsRes] = await Promise.all([
        fetch(`/api/events/${eventId}`, { credentials: 'include' }),
        fetch(`/api/events/${eventId}/guests`, { credentials: 'include' }),
      ]);

      const eventData = await eventRes.json();
      const guestsData = await guestsRes.json();

      const eventObj = eventData.event || eventData;
      setEvent(eventObj);

      const formattedDate = eventObj?.date
        ? new Date(eventObj.date).toLocaleDateString('sw-TZ', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        : '';

      // ─── Load saved SMS state or use defaults ──────────────────────
      const hasSaved = loadSmsState();

      if (!hasSaved) {
        // Set default variables from event
        setSmsVariables({
          hostFamily: eventObj?.hostFamily || '',
          person1: eventObj?.person1 || '',
          person2: eventObj?.person2 || '',
          eventDate: formattedDate,
          venue: eventObj?.venue || '',
          time: eventObj?.time || '',
        });

        // Keep placeholders in the template; values are substituted at
        // preview/send time via buildSmsMessage / the backend.

        setSmsTemplate(DEFAULT_SMS_TEMPLATE);
      }

      // ─── Load saved WhatsApp state ──────────────────────────────────
      const hasWhatsappSaved = loadWhatsappState();

      if (!hasWhatsappSaved) {
        setWhatsappVariables({
          hostFamily: eventObj?.hostFamily || '',
          person1: eventObj?.person1 || '',
          person2: eventObj?.person2 || '',
          eventDate: formattedDate,
          venue: eventObj?.venue || '',
          time: eventObj?.time || '',
        });
      }

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

  // ─── Helper: Insert variable at cursor position ──────────────────────
  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('sms-template-editor') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = smsTemplate;
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + variable + after;

    setSmsTemplate(newText);

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + variable.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  // ─── Update SMS variable ──────────────────────────────────────────────
  const updateSmsVariable = (key: string, value: string) => {
    setSmsVariables(prev => ({ ...prev, [key]: value }));
  };

  // ─── Update WhatsApp variable ─────────────────────────────────────────
  const updateWhatsappVariable = (key: string, value: string) => {
    setWhatsappVariables(prev => ({ ...prev, [key]: value }));
  };

  // ─── Choose an approved template ──────────────────────────────────────
  const applyTemplate = (id: string) => {
    const t = INVITE_TEMPLATES[id];
    if (!t) return;
    setSelectedTemplate(id);
    setSmsTemplate(t.smsBody);
    toast.success(`${t.label} template selected`);
  };

  // ─── Build SMS Message from Template ──────────────────────────────────
  const buildSmsMessage = (template: string, guest: Guest): string => {
    const fullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;
    const cardNumber = guest.cardNumber || '';
    const guestType = guest.guestType === 'DOUBLE' ? 'Double' : 'Single';

    const varsMap: Record<string, string> = {
      guestName: fullName,
      guestTitle: guest.title || '',
      title: guest.title || '',
      name: guest.name || '',
      fullName,
      cardNumber,
      cardNo: cardNumber,
      guestType,
      cardType: guestType,
      hostFamily: smsVariables.hostFamily,
      person1: smsVariables.person1,
      person2: smsVariables.person2,
      eventDate: smsVariables.eventDate,
      venue: smsVariables.venue,
      time: smsVariables.time,
      contact: contactInfo,
    };

    return template.replace(
      /\{(guestName|guestTitle|title|name|fullName|cardNumber|cardNo|guestType|cardType|hostFamily|person1|person2|eventDate|venue|time|contact)\}/g,
      (match: string, key: string) => varsMap[key] ?? match
    );
  };

  // ─── Get sample SMS preview ──────────────────────────────────────────
  const getSampleSmsPreview = (): string => {
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
      checkedIn: false,
      guestType: 'DOUBLE',
    };
    return buildSmsMessage(smsTemplate, sampleGuest);
  };

  // ─── Switch All Guests to WhatsApp ──────────────────────────────────
  const switchAllToWhatsApp = async () => {
    const smsGuests = guests.filter(g => g.routingChannel === 'sms');
    if (smsGuests.length === 0) {
      toast('All guests are already on WhatsApp');
      return;
    }

    const ok = await confirmToast({ title: `Switch ${smsGuests.length} guests from SMS to WhatsApp?`, confirmText: 'Switch' });
    if (!ok) return;

    setSwitchingAll(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const guest of smsGuests) {
        try {
          const res = await fetch(`/api/guests/${guest.id}/channel`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ routingChannel: 'whatsapp' }),
            credentials: 'include',
          });

          if (res.ok) {
            successCount++;
          } else {
            failCount++;
          }
        } catch {
          failCount++;
        }
      }

      await loadData();

      if (successCount === smsGuests.length) {
        toast.success(`All ${successCount} guests switched to WhatsApp`);
      } else {
        toast(`${successCount} switched, ${failCount} failed`);
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setSwitchingAll(false);
    }
  };

  // ─── Switch Single Guest Channel ──────────────────────────────────────
  const switchGuestChannel = async (guestId: string, newChannel: string) => {
    setSwitchingChannel(guestId);
    try {
      const res = await fetch(`/api/guests/${guestId}/channel`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ routingChannel: newChannel }),
        credentials: 'include',
      });

      if (res.ok) {
        toast.success(`Switched to ${newChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}`);
        await loadData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to switch');
      }
    } catch (error) {
      toast.error('Network error');
    } finally {
      setSwitchingChannel(null);
    }
  };

  // ─── Generate Cards ────────────────────────────────────────────────────
  const handleGenerateCards = async () => {
    // Regenerate guests that are missing a pass code OR a card image.
    const pendingGuests = guests.filter(g => !g.passCode || !g.invitationCard);
    if (pendingGuests.length === 0) {
      toast.success('All guests already have cards');
      return;
    }

    setGeneratingCards(true);
    setCardGenErrors([]);
    const CHUNK_SIZE = 25;
    const allIds = pendingGuests.map(g => g.id);
    let completed = 0;
    let failed = 0;
    setGenProgress({ done: 0, total: allIds.length });

    try {
      for (let i = 0; i < allIds.length; i += CHUNK_SIZE) {
        const chunk = allIds.slice(i, i + CHUNK_SIZE);

        const res = await fetch('/api/invitations/generate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId, guestIds: chunk }),
          credentials: 'include',
        });

        const data = await res.json();

        if (res.ok) {
          completed += data.completed ?? 0;
          failed += data.failed ?? 0;
          // Surface per-guest errors from the batch results
          const errs = (data.results || []).filter((r: any) => !r.success);
          if (errs.length > 0) {
            setCardGenErrors(prev => [
              ...prev,
              ...errs.map((r: any) => ({ name: r.name || r.guestId, error: r.error || 'Unknown error' })),
            ]);
          }
        } else {
          failed += chunk.length;
          console.error('Chunk failed:', data.error);
        }

        const done = Math.min(i + CHUNK_SIZE, allIds.length);
        setGenProgress({ done, total: allIds.length });
        await loadData();
      }

      if (failed === 0) {
        toast.success(`${completed} cards generated`, { duration: 3000 });
      } else if (completed > 0) {
        toast(`${completed} generated, ${failed} failed — click Cards again to retry`, { duration: 4000 });
      } else {
        toast.error('Failed to generate cards', { duration: 3000 });
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('Network error — click Cards again to resume', { duration: 3000 });
    } finally {
      setGeneratingCards(false);
      setTimeout(() => setGenProgress(null), 1500);
    }
  };

  // ─── Core send routine (send-batch) ───────────────────────────────────
  const performSend = async (targetGuests: Guest[], noSelectionMessage?: string) => {
    if (targetGuests.length === 0) {
      toast.error(noSelectionMessage || 'No guests matching the current filters');
      return;
    }

    setSending(true);
    setResults([]);
    setWhatsappFailed([]);

    const toastId = toast.loading(`Sending to ${targetGuests.length} guests...`);

    try {
      const guestIds = targetGuests.map(g => g.id);

      const res = await fetch('/api/invitations/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          guestIds,
          smsTemplate,
          smsVariables,
          whatsappVariables,
          whatsappTemplate: INVITE_TEMPLATES[selectedTemplate]?.whatsappName,
          whatsappContact: contactInfo,
        }),
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok) {
        setResults(data.results || []);

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

          toast.custom(
            (t) => (
              <div
                className={`${t.visible ? 'animate-enter' : 'animate-leave'
                  } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex flex-col overflow-hidden border border-gray-200`}
              >
                <div className="p-4 bg-amber-50 border-b border-amber-200">
                  <h3 className="font-semibold text-amber-800 flex items-center gap-2 text-sm">
                    <AlertCircle size={18} />
                    WhatsApp Failed - Fallback to SMS
                  </h3>
                </div>
                <div className="p-4 max-h-48 overflow-y-auto">
                  <p className="text-sm text-gray-600 mb-2">
                    The following guests were switched to SMS:
                  </p>
                  <div className="space-y-1">
                    {failedWhatsApp.map((r: any) => (
                      <div key={r.guestId} className="text-sm text-gray-700 flex items-center gap-2">
                        <span className="font-medium truncate">{r.name}</span>
                        <span className="text-gray-400 text-xs truncate">
                          {guests.find((g) => g.id === r.guestId)?.phone}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 border-t border-gray-100">
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="w-full bg-[#0D4B4B] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0A3939] transition"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ),
            { duration: 6000 }
          );
        }

        if (data.successCount === data.total) {
          toast.success(`Sent to all ${data.total} guests`, { id: toastId, duration: 3000 });
        } else if (data.successCount > 0) {
          toast(`${data.successCount} of ${data.total} sent`, {
            id: toastId,
            duration: 4000,
            icon: <AlertTriangle size={18} className="text-amber-500" />,
          });
        } else {
          toast.error('Failed to send to any guests', { id: toastId, duration: 3000 });
        }

        await loadData();
      } else {
        toast.error(data.error || 'Failed to send', { id: toastId, duration: 3000 });
      }
    } catch (error) {
      console.error('Broadcast error:', error);
      toast.error('Network error', { id: toastId, duration: 3000 });
    } finally {
      setSending(false);
    }
  };

  // ─── Broadcast to all guests (only guests not yet invited) ────────────
  const broadcast = async () => {
    const allTargets = getFilteredGuests();
    // "Send All" only sends to guests who have not received an invitation yet.
    const targetGuests = allTargets.filter(g => !g.invitationSentAt);
    await performSend(targetGuests, allTargets.length > 0
      ? 'All matching guests have already received their invitations'
      : 'No guests matching the current filters');
  };

  // ─── Send to selected guests only ─────────────────────────────────────
  const sendSelected = async () => {
    const selected = guests.filter(g => selectedGuests.has(g.id) && !g.invitationSentAt);
    await performSend(selected, 'No guests selected');
    setSelectedGuests(new Set());
  };

  // ─── Retry Failed Messages ────────────────────────────────────────────
  const retryFailed = async () => {
    const failedGuestIds = results.filter(r => !r.success).map(r => r.guestId);
    if (failedGuestIds.length === 0) {
      toast('No failed messages to retry', { duration: 2000 });
      return;
    }

    setRetrying(true);
    const toastId = toast.loading(`Retrying ${failedGuestIds.length} messages...`);

    try {
      const res = await fetch('/api/invitations/send-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          guestIds: failedGuestIds,
          smsTemplate,
          smsVariables,
          whatsappVariables,
          whatsappTemplate: INVITE_TEMPLATES[selectedTemplate]?.whatsappName,
          whatsappContact: contactInfo,
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

        toast.success(`Retried ${data.successCount} messages`, { id: toastId, duration: 3000 });
        await loadData();
      } else {
        toast.error('Failed to retry', { id: toastId, duration: 3000 });
      }
    } catch (error) {
      console.error('Retry error:', error);
      toast.error('Network error', { id: toastId, duration: 3000 });
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

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(g =>
        g.name.toLowerCase().includes(query) ||
        (g.title && g.title.toLowerCase().includes(query)) ||
        (g.phone && g.phone.includes(query)) ||
        (g.cardNumber && g.cardNumber.includes(query)) ||
        (g.passCode && g.passCode.toLowerCase().includes(query))
      );
    }

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
  }, [guests, filterChannel, filterStatus, results, searchQuery]);

  const filteredGuests = getFilteredGuests();

  // ─── Filter counts for UI ─────────────────────────────────────────────
  const filterCounts = {
    all: guests.length,
    whatsapp: guests.filter(g => g.routingChannel === 'whatsapp').length,
    sms: guests.filter(g => g.routingChannel === 'sms').length,
    sent: guests.filter(g => g.invitationSentAt).length,
    pending: guests.filter(g => !g.invitationSentAt).length,
    failed: results.filter(r => !r.success).length,
  };

  // ─── Get guest status ──────────────────────────────────────────────────
  const getGuestStatus = (guest: Guest): 'sent' | 'pending' | 'failed' => {
    const result = results.find(r => r.guestId === guest.id);
    if (result) return result.success ? 'sent' : 'failed';
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 size={32} className="animate-spin text-[#0D4B4B]" />
        <p className="text-sm text-gray-400">Loading invitations...</p>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
      {/* ─── Header ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Link
            href={`/client/events/${eventId}`}
            className="flex-shrink-0 p-2 text-gray-500 hover:text-[#0D4B4B] transition rounded-xl hover:bg-gray-100"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="min-w-0">
            <h1 className="font-serif text-xl sm:text-2xl lg:text-3xl font-black text-gray-900 truncate">
              Send Invitations
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">
              {event?.name} · {guests.length} guests
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerateCards}
            disabled={generatingCards || guests.length === 0}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-amber-600 text-white rounded-xl font-semibold text-xs sm:text-sm hover:bg-amber-700 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {generatingCards ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            <span className="hidden xs:inline">Cards</span>
            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
              {guestsWithoutPassCode}
            </span>
          </button>
          <button
            onClick={switchAllToWhatsApp}
            disabled={switchingAll || smsCount === 0}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-xl font-semibold text-xs sm:text-sm hover:bg-green-700 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {switchingAll ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            <span className="hidden sm:inline">Switch All to WA</span>
            <span className="sm:hidden">Switch to WA</span>
          </button>
          <button
            onClick={() => sendToChannel('whatsapp')}
            disabled={sending || whatsappCount === 0}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#0D4B4B] text-white rounded-xl font-semibold text-xs sm:text-sm hover:bg-[#0A3939] transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <MessageCircle size={14} />
            <span className="hidden xs:inline">WhatsApp</span>
            <span className="xs:hidden">WA</span>
            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{whatsappCount}</span>
          </button>
          <button
            onClick={() => sendToChannel('sms')}
            disabled={sending || smsCount === 0}
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-700 text-white rounded-xl font-semibold text-xs sm:text-sm hover:bg-gray-800 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Phone size={14} />
            <span className="hidden xs:inline">SMS</span>
            <span className="xs:hidden">SMS</span>
            <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{smsCount}</span>
          </button>
          {failedCount > 0 && (
            <button
              onClick={retryFailed}
              disabled={retrying || sending}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white rounded-xl font-semibold text-xs sm:text-sm hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {retrying ? <Loader2 size={14} className="animate-spin" /> : <RotateCw size={14} />}
              <span className="hidden xs:inline">Retry</span>
              <span className="xs:hidden">↻</span>
              <span className="bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">{failedCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── Card Generation Progress ─── */}
      {genProgress && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
          <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
            <span className="font-medium text-gray-700 flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-600" />
              Generating cards
            </span>
            <span className="text-gray-400 font-mono">
              {genProgress.done} / {genProgress.total}
            </span>
          </div>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${(genProgress.done / genProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* ─── Channel Toggle ─── */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1 sm:gap-2 bg-white p-1 rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => setActiveChannel('sms')}
            className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm transition flex items-center gap-1.5 ${activeChannel === 'sms'
              ? 'bg-[#0D4B4B] text-white shadow-sm'
              : 'text-gray-500 hover:bg-gray-50'
              }`}
          >
            <Phone size={14} /> SMS
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{smsCount}</span>
          </button>
          <button
            onClick={() => setActiveChannel('whatsapp')}
            className={`px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg font-semibold text-xs sm:text-sm transition flex items-center gap-1.5 ${activeChannel === 'whatsapp'
              ? 'bg-[#0D4B4B] text-white shadow-sm'
              : 'text-gray-500 hover:bg-gray-50'
              }`}
          >
            <MessageCircle size={14} /> WhatsApp
            <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full">{whatsappCount}</span>
          </button>
        </div>
      </div>

      {/* ─── Template Picker ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={18} className="text-[#0D4B4B]" />
          <h2 className="font-semibold text-gray-800 text-base">Choose Invitation Template</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Select an approved template. This sets both the WhatsApp template name and the SMS message.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(INVITE_TEMPLATES).map(([id, t]) => (
            <button
              key={id}
              type="button"
              onClick={() => applyTemplate(id)}
              className={`text-left rounded-xl border p-4 transition-all ${
                selectedTemplate === id
                  ? 'border-[#0D4B4B] bg-[#0D4B4B]/5 ring-1 ring-[#0D4B4B]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm text-gray-900">
                  <Check size={14} className={`inline mr-1 ${selectedTemplate === id ? 'text-[#0D4B4B]' : 'text-gray-300'}`} />
                  {t.label}
                </p>
                <code className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-500">
                  {t.whatsappName}
                </code>
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                WhatsApp template: <b>{t.whatsappName}</b>
                {t.hasContact ? ' · includes a contact variable' : ''}
              </p>
            </button>
          ))}
        </div>

        {INVITE_TEMPLATES[selectedTemplate]?.hasContact && (
          <div className="mt-4">
            <label className="block text-[10px] font-medium text-gray-700 mb-1">
              Contact Info (variable: {'{contact}'} / var10)
              <span className="text-gray-400 text-[8px] ml-1">e.g. +255 712 345 678</span>
            </label>
            <input
              type="text"
              value={contactInfo}
              onChange={(e) => setContactInfo(e.target.value)}
              placeholder="Enter contact for var10..."
              className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-gray-50"
            />
          </div>
        )}
      </div>

      {/* ─── SMS Editor ─── */}
      {activeChannel === 'sms' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-[#0D4B4B]" />
              <h2 className="font-semibold text-gray-800 text-base">SMS Template</h2>
              <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Editable</span>
            </div>
            <button
              onClick={() => setShowVariables(!showVariables)}
              className="text-xs text-[#0D4B4B] hover:text-[#0A3939] font-medium flex items-center gap-1"
            >
              <HelpCircle size={14} />
              {showVariables ? 'Hide Variables' : 'Show Variables'}
            </button>
          </div>

          {/* ─── SMS Variable Fields ─── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {Object.entries(SMS_FIELD_LABELS).map(([key, label]) => (
              <div key={key}>
                <label className="block text-[10px] font-medium text-gray-700 mb-1">
                  {label}
                  <span className="text-gray-400 text-[8px] ml-1">(variable: {'{'}{key}{'}'})</span>
                </label>
                <input
                  type="text"
                  value={smsVariables[key] || ''}
                  onChange={(e) => updateSmsVariable(key, e.target.value)}
                  className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-gray-50"
                  placeholder={`Enter ${label.toLowerCase()}`}
                />
              </div>
            ))}
          </div>

          {/* ─── Variables Panel ─── */}
          {showVariables && (
            <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
              <p className="text-xs font-medium text-blue-800 mb-2 flex items-center gap-1.5">
                <Info size={14} />
                Available Variables - Click to insert
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SMS_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    onClick={() => insertVariable(v.key)}
                    className="text-[10px] bg-white border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition flex items-center gap-1 group"
                    title={`${v.label}: ${v.example}`}
                  >
                    <code className="text-blue-700 font-mono text-[9px]">{v.key}</code>
                    <span className="text-gray-400 text-[8px] group-hover:text-gray-600">↗</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Template Editor ─── */}
          <div className="relative">
            <textarea
              id="sms-template-editor"
              value={smsTemplate}
              onChange={(e) => setSmsTemplate(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent min-h-[200px] resize-y"
              placeholder="Write your SMS template here..."
            />
            <div className="absolute bottom-3 right-3 text-[10px] text-gray-400 bg-white/80 px-2 py-1 rounded">
              {smsTemplate.length} characters
            </div>
          </div>

          {/* ─── Preview ─── */}
          <div className="mt-4">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-1.5"
            >
              {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
              {showPreview ? 'Hide Preview' : 'Show Preview'}
            </button>

            {showPreview && (
              <div className="mt-2 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <Eye size={12} /> Preview (sample guest)
                </p>
                <div className="bg-white rounded-lg p-4 text-sm text-gray-700 font-mono whitespace-pre-wrap border border-gray-100 max-h-60 overflow-y-auto">
                  {getSampleSmsPreview()}
                </div>
              </div>
            )}
          </div>

          {/* ─── Auto-save indicator ─── */}
          <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400">
            <div className="flex items-center gap-2">
              <Save size={12} className="text-green-500" />
              <span>Auto-saved</span>
            </div>
            <span>Changes are saved automatically</span>
          </div>
        </div>
      )}

      {/* ─── WhatsApp Editor ─── */}
      {activeChannel === 'whatsapp' && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle size={18} className="text-green-600" />
            <h2 className="font-semibold text-gray-800 text-base">WhatsApp Template</h2>
            <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Pre-approved</span>
            <code className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {INVITE_TEMPLATES[selectedTemplate]?.whatsappName || 'Mwalikotemp'}
            </code>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <label className="block text-[10px] font-medium text-gray-500">Guest Name</label>
              <p className="text-sm text-gray-700 font-medium">Auto-replaced</p>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-700">Host Family</label>
              <input
                type="text"
                value={whatsappVariables.hostFamily || ''}
                onChange={(e) => updateWhatsappVariable('hostFamily', e.target.value)}
                className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-gray-50"
                placeholder="Host family name"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-700">Person 1</label>
              <input
                type="text"
                value={whatsappVariables.person1 || ''}
                onChange={(e) => updateWhatsappVariable('person1', e.target.value)}
                className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-gray-50"
                placeholder="e.g., Agape"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-700">Person 2</label>
              <input
                type="text"
                value={whatsappVariables.person2 || ''}
                onChange={(e) => updateWhatsappVariable('person2', e.target.value)}
                className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-gray-50"
                placeholder="e.g., Gladness"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-700">Date</label>
              <input
                type="text"
                value={whatsappVariables.eventDate || ''}
                onChange={(e) => updateWhatsappVariable('eventDate', e.target.value)}
                className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-gray-50"
                placeholder="e.g., 15 Septemba, 2026"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-700">Venue</label>
              <input
                type="text"
                value={whatsappVariables.venue || ''}
                onChange={(e) => updateWhatsappVariable('venue', e.target.value)}
                className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-gray-50"
                placeholder="e.g., The Embassy Hall"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-gray-700">Time</label>
              <input
                type="text"
                value={whatsappVariables.time || ''}
                onChange={(e) => updateWhatsappVariable('time', e.target.value)}
                className="w-full p-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-gray-50"
                placeholder="e.g., 5:00 PM"
              />
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <label className="block text-[10px] font-medium text-gray-500">Card Number</label>
              <p className="text-sm text-gray-700 font-medium">Auto-replaced</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <label className="block text-[10px] font-medium text-gray-500">Card Type</label>
              <p className="text-sm text-gray-700 font-medium">Auto-replaced</p>
            </div>
          </div>

          {showPreview && (
            <div className="mt-4 p-3 bg-green-50 rounded-xl border border-green-200">
              <p className="text-[10px] font-medium text-green-700 uppercase tracking-wider flex items-center gap-2">
                <Eye size={12} /> Template Preview
              </p>
              <div className="mt-1 bg-white rounded-lg p-3 text-xs sm:text-sm text-gray-700 whitespace-pre-wrap border border-green-100 max-h-48 overflow-y-auto">
                {`Habari {guestName},

Familia ya ${whatsappVariables.hostFamily || '{hostFamily}'} inakualika katika sherehe ya harusi ya ${whatsappVariables.person1 || '{person1}'} na ${whatsappVariables.person2 || '{person2}'} itakayofanyika tarehe ${whatsappVariables.eventDate || '{eventDate}'}.

Reception: ${whatsappVariables.venue || '{venue}'}, saa ${whatsappVariables.time || '{time}'}

Card No: {cardNumber} {guestType}`}
              </div>
            </div>
          )}

          {/* ─── Auto-save indicator ─── */}
          <div className="mt-3 flex items-center justify-between text-[10px] text-gray-400">
            <div className="flex items-center gap-2">
              <Save size={12} className="text-green-500" />
              <span>Auto-saved</span>
            </div>
            <span>Changes are saved automatically</span>
          </div>
        </div>
      )}

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-2 sm:p-3 text-center shadow-sm">
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{guests.length}</p>
          <p className="text-[8px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-wider">Total</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-2 sm:p-3 text-center shadow-sm">
          <p className="text-lg sm:text-2xl font-bold text-green-600">{whatsappCount}</p>
          <p className="text-[8px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-wider">WhatsApp</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-2 sm:p-3 text-center shadow-sm">
          <p className="text-lg sm:text-2xl font-bold text-blue-600">{sentCount}</p>
          <p className="text-[8px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-wider">Sent</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-2 sm:p-3 text-center shadow-sm">
          <p className="text-lg sm:text-2xl font-bold text-amber-600">{guests.filter(g => g.invitationCard).length}</p>
          <p className="text-[8px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-wider">Cards</p>
        </div>
      </div>

      {/* ─── Filters ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 mb-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-gray-400" />
          <span className="text-xs font-medium text-gray-600">Filters</span>
          {(filterChannel !== 'all' || filterStatus !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setFilterChannel('all');
                setFilterStatus('all');
                setSearchQuery('');
              }}
              className="ml-auto text-[10px] sm:text-xs text-[#0D4B4B] hover:text-[#0A3939] font-medium flex items-center gap-1"
            >
              <XCircle size={12} />
              Clear all
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, card number..."
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-gray-50"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <XCircle size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Channel filters */}
          <div className="flex gap-1">
            <button
              onClick={() => setFilterChannel('all')}
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium transition ${filterChannel === 'all'
                ? 'bg-[#0D4B4B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              All
              <span className="ml-1 text-[9px] opacity-75">({filterCounts.all})</span>
            </button>
            <button
              onClick={() => setFilterChannel('whatsapp')}
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium transition flex items-center gap-1 ${filterChannel === 'whatsapp'
                ? 'bg-[#0D4B4B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <MessageCircle size={10} /> WA
              <span className="text-[9px] opacity-75">({filterCounts.whatsapp})</span>
            </button>
            <button
              onClick={() => setFilterChannel('sms')}
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium transition flex items-center gap-1 ${filterChannel === 'sms'
                ? 'bg-[#0D4B4B] text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <Phone size={10} /> SMS
              <span className="text-[9px] opacity-75">({filterCounts.sms})</span>
            </button>
          </div>

          <div className="w-px h-5 bg-gray-200" />

          {/* Status filters */}
          <div className="flex gap-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium transition ${filterStatus === 'all'
                ? 'bg-gray-700 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('sent')}
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium transition flex items-center gap-1 ${filterStatus === 'sent'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <CheckCircle size={10} /> Sent
              <span className="text-[9px] opacity-75">({filterCounts.sent})</span>
            </button>
            <button
              onClick={() => setFilterStatus('pending')}
              className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium transition flex items-center gap-1 ${filterStatus === 'pending'
                ? 'bg-amber-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
            >
              <Clock size={10} /> Pending
              <span className="text-[9px] opacity-75">({filterCounts.pending})</span>
            </button>
            {filterCounts.failed > 0 && (
              <button
                onClick={() => setFilterStatus('failed')}
                className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium transition flex items-center gap-1 ${filterStatus === 'failed'
                  ? 'bg-red-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                <XCircle size={10} /> Failed
                <span className="text-[9px] opacity-75">({filterCounts.failed})</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── Friendly helper note ─── */}
      <div className="bg-[#EDFAF4] border border-[#A8D5C4] rounded-2xl px-3 sm:px-4 py-2.5 flex items-start gap-2.5">
        <Info size={16} className="text-[#1A7A4A] flex-shrink-0 mt-0.5" />
        <p className="text-xs sm:text-sm text-[#14532d] leading-relaxed">
          <span className="font-semibold">How sending works:</span> Sending is free — credits are only used when you
          <span className="font-medium"> add or import</span> a guest (1 credit per guest). <span className="font-semibold">Send All</span> only sends to guests who
          haven't received their invitation yet, so you can send safely without duplicating.
        </p>
      </div>

      {/* ─── Guest List ─── */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#0D4B4B]" />
            <span className="font-semibold text-gray-800 text-sm">
              {filteredGuests.length} guest{filteredGuests.length !== 1 ? 's' : ''}
            </span>
            {filterChannel !== 'all' && (
              <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                {filterChannel === 'whatsapp' ? <MessageCircle size={8} /> : <Phone size={8} />}
                {filterChannel}
              </span>
            )}
            {filterStatus !== 'all' && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
                filterStatus === 'sent' ? 'bg-green-100 text-green-700' :
                filterStatus === 'pending' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {filterStatus === 'sent' && <CheckCircle size={8} />}
                {filterStatus === 'pending' && <Clock size={8} />}
                {filterStatus === 'failed' && <XCircle size={8} />}
                {filterStatus}
              </span>
            )}
            {searchQuery && (
              <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                "{searchQuery}"
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-gray-400">
              {successCount} sent · {failedCount} failed
            </span>

            {!selecting ? (
              <button
                onClick={() => { setSelecting(true); setSelectedGuests(new Set()); }}
                disabled={sending || loadingGuests}
                className="px-3 sm:px-4 py-1 sm:py-1.5 border border-[#0D4B4B] text-[#0D4B4B] rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#0D4B4B] hover:text-white transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <CheckSquare size={14} />
                Select
              </button>
            ) : (
              <>
                <span className="text-[10px] font-semibold text-[#0D4B4B]">
                  {selectedGuests.size} selected
                </span>
                <button
                  onClick={sendSelected}
                  disabled={sending || selectedGuests.size === 0}
                  className="px-3 sm:px-4 py-1 sm:py-1.5 bg-[#0D4B4B] text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#0A3939] transition disabled:opacity-50 flex items-center gap-1.5"
                >
                  {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={14} />}
                  {sending ? 'Sending...' : `Send Selected (${selectedGuests.size})`}
                </button>
                <button
                  onClick={() => { setSelecting(false); setSelectedGuests(new Set()); }}
                  disabled={sending}
                  className="px-2 py-1 text-[10px] sm:text-xs text-gray-500 hover:text-gray-700 font-medium transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}

            <button
              onClick={broadcast}
              disabled={sending || filteredGuests.length === 0 || loadingGuests}
              className="px-3 sm:px-4 py-1 sm:py-1.5 bg-[#0D4B4B] text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-[#0A3939] transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Sending...' : 'Send All'}
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-100 max-h-[500px] sm:max-h-[600px] overflow-y-auto">
          {loadingGuests ? (
            <div className="flex justify-center py-12">
              <Loader2 size={24} className="animate-spin text-[#0D4B4B]" />
            </div>
          ) : filteredGuests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Users size={40} className="mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-sm">No guests match your filters</p>
              <p className="text-xs text-gray-400 mt-1">
                {searchQuery ? `No results for "${searchQuery}"` : 'Try adjusting your filters'}
              </p>
              <button
                onClick={() => {
                  setFilterChannel('all');
                  setFilterStatus('all');
                  setSearchQuery('');
                }}
                className="mt-3 text-xs text-[#0D4B4B] hover:text-[#0A3939] font-medium"
              >
                Clear all filters
              </button>
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
                  className={`px-3 sm:px-5 py-2 sm:py-3 hover:bg-gray-50 transition cursor-pointer ${status === 'sent' ? 'bg-green-50/30' : ''
                    } ${status === 'failed' ? 'bg-red-50/30' : ''}`}
                  onClick={() => setExpandedGuest(isExpanded ? null : guest.id)}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* Selection checkbox */}
                    {selecting && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedGuests(prev => {
                            const next = new Set(prev);
                            if (next.has(guest.id)) {
                              next.delete(guest.id);
                            } else {
                              next.add(guest.id);
                            }
                            return next;
                          });
                        }}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition ${
                          selectedGuests.has(guest.id)
                            ? 'bg-[#0D4B4B] border-[#0D4B4B] text-white'
                            : 'border-gray-300 bg-white hover:border-[#0D4B4B]'
                        }`}
                      >
                        {selectedGuests.has(guest.id) && <Check size={13} />}
                      </button>
                    )}

                    {/* Avatar */}
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-[#0D4B4B] to-[#0A3939] flex items-center justify-center text-white font-bold text-xs sm:text-sm flex-shrink-0">
                      {guest.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                        <span className="font-semibold text-gray-900 text-xs sm:text-sm truncate">{fullName}</span>
                        <span className={`text-[9px] sm:text-xs font-medium px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-0.5 sm:gap-1 ${isWhatsApp
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                          }`}>
                          {isWhatsApp ? <MessageCircle size={9} /> : <Phone size={9} />}
                          <span className="hidden xs:inline">{isWhatsApp ? 'WhatsApp' : 'SMS'}</span>
                          <span className="xs:hidden">{isWhatsApp ? 'WA' : 'SMS'}</span>
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const newChannel = isWhatsApp ? 'sms' : 'whatsapp';
                            switchGuestChannel(guest.id, newChannel);
                          }}
                          disabled={switchingChannel === guest.id}
                          className="text-[9px] sm:text-[10px] text-blue-500 hover:text-blue-700 transition font-medium disabled:opacity-50 flex items-center gap-0.5"
                        >
                          {switchingChannel === guest.id ? (
                            <Loader2 size={9} className="animate-spin" />
                          ) : (
                            <>
                              <RotateCw size={9} />
                              <span className="hidden xs:inline">{isWhatsApp ? '→ SMS' : '→ WA'}</span>
                            </>
                          )}
                        </button>
                        {guest.cardNumber && (
                          <span className="text-[9px] sm:text-xs text-gray-400 font-mono">#{guest.cardNumber}</span>
                        )}
                        {guest.passCode && (
                          <span className="text-[9px] sm:text-xs text-purple-600 font-mono bg-purple-50 px-1.5 py-0.5 rounded-full">
                            {guest.passCode}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[9px] sm:text-xs text-gray-400 mt-0.5">
                        {guest.phone && <span className="truncate max-w-[100px] sm:max-w-none">{guest.phone}</span>}
                        {guest.invitationSentAt && (
                          <span className="text-green-600 flex items-center gap-0.5">
                            <CheckCircle size={9} />
                            <span className="hidden xs:inline">Sent</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Status Icon */}
                    <div className="flex-shrink-0">
                      {status === 'sent' && <CheckCircle size={14} className="sm:text-lg text-green-600" />}
                      {status === 'pending' && <Clock size={14} className="sm:text-lg text-amber-500" />}
                      {status === 'failed' && <XCircle size={14} className="sm:text-lg text-red-500" />}
                    </div>

                    {/* Expand */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedGuest(isExpanded ? null : guest.id);
                      }}
                      className="p-1 hover:bg-gray-200 rounded-lg transition text-gray-400 flex-shrink-0"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {/* ─── Expanded Content ─── */}
                  {isExpanded && (
                    <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {guest.invitationCard && (
                        <div
                          className="bg-gray-50 rounded-xl p-2 text-center cursor-pointer hover:shadow-md transition"
                          onClick={() => setSelectedCard({
                            url: guest.invitationCard!,
                            name: getFullName(guest),
                            cardNumber: guest.cardNumber || undefined
                          })}
                        >
                          <p className="inline-flex items-center gap-1 text-[10px] text-gray-500 mb-1"><MousePointerClick size={11} /> Click to view</p>
                          <img
                            src={guest.invitationCard}
                            alt="Card"
                            className="max-w-[80px] sm:max-w-[120px] max-h-[120px] sm:max-h-[160px] mx-auto rounded-lg shadow-sm object-contain"
                          />
                        </div>
                      )}
                      <div className="space-y-1 text-xs sm:text-sm">
                        <div className="flex items-center gap-2">
                          <User size={12} className="text-gray-400" />
                          <span className="text-gray-600 truncate">{fullName}</span>
                        </div>
                        {guest.phone && (
                          <div className="flex items-center gap-2">
                            <Phone size={12} className="text-gray-400" />
                            <span className="text-gray-600 truncate">{guest.phone}</span>
                          </div>
                        )}
                        {guest.cardNumber && (
                          <div className="flex items-center gap-2">
                            <Hash size={12} className="text-gray-400" />
                            <span className="text-gray-600 font-mono">{guest.cardNumber}</span>
                          </div>
                        )}
                        {guest.passCode && (
                          <div className="flex items-center gap-2">
                            <QrCode size={12} className="text-gray-400" />
                            <span className="text-gray-600 font-mono">{guest.passCode}</span>
                          </div>
                        )}
                        {guest.invitationSentAt && (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle size={12} />
                            <span>Sent {new Date(guest.invitationSentAt).toLocaleDateString()}</span>
                          </div>
                        )}
                        {guest.checkedIn && (
                          <div className="flex items-center gap-2 text-blue-600">
                            <CheckCircle size={12} />
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
        <div className="mt-4 bg-white rounded-xl border border-gray-200 p-3 sm:p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-gray-700">Results</p>
            <button
              onClick={() => setResults([])}
              className="text-xs text-gray-400 hover:text-gray-600 transition"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-3 sm:gap-6 text-xs sm:text-sm mt-2">
            <span className="text-green-600 flex items-center gap-1">
              <CheckCircle size={12} /> {results.filter(r => r.success).length} sent
            </span>
            <span className="text-red-500 flex items-center gap-1">
              <XCircle size={12} /> {results.filter(r => !r.success).length} failed
            </span>
            <span className="text-gray-400">
              {results.filter(r => r.channel === 'whatsapp').length} WA · {results.filter(r => r.channel === 'sms').length} SMS
            </span>
          </div>
          {results.filter(r => !r.success).length > 0 && (
            <div className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded-lg max-h-24 overflow-y-auto">
              {results.filter(r => !r.success).map(r => (
                <div key={r.guestId}>• {r.name}: {r.error}</div>
              ))}
            </div>
          )}
          {results.filter(r => r.success).length > 0 && results.filter(r => !r.success).length > 0 && (
            <button
              onClick={retryFailed}
              disabled={retrying}
              className="mt-2 px-3 sm:px-4 py-1 sm:py-1.5 bg-red-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-red-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {retrying ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={14} />}
              Retry Failed
            </button>
          )}
        </div>
      )}

      {/* ─── WhatsApp Failed Summary ─── */}
      {whatsappFailed.length > 0 && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle size={14} className="text-amber-600" />
            <p className="font-semibold text-amber-800 text-xs sm:text-sm">WhatsApp Fallback</p>
          </div>
          <p className="text-[10px] sm:text-xs text-amber-600 mb-1">
            {whatsappFailed.length} guests switched to SMS:
          </p>
          <div className="flex flex-wrap gap-1">
            {whatsappFailed.map((guest, index) => (
              <span key={index} className="text-[10px] sm:text-xs bg-white px-2 py-0.5 rounded-full border border-amber-200 text-gray-700">
                {guest.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {cardGenErrors.length > 0 && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-1">
            <XCircle size={14} className="text-red-600" />
            <p className="font-semibold text-red-800 text-xs sm:text-sm">Card Generation Errors</p>
            <span className="text-[10px] text-red-500">({cardGenErrors.length})</span>
          </div>
          <div className="max-h-36 overflow-y-auto text-[11px] sm:text-xs text-red-700 space-y-1 mt-1">
            {cardGenErrors.map((e, index) => (
              <div key={index}>• <span className="font-medium">{e.name}:</span> {e.error}</div>
            ))}
          </div>
          <button
            onClick={() => setCardGenErrors([])}
            className="mt-2 text-[10px] sm:text-xs text-red-500 hover:text-red-700 font-medium transition"
          >
            Dismiss
          </button>
        </div>
      )}

      {selectedCard && (
        <CardViewerModal
          isOpen={!!selectedCard}
          onClose={() => setSelectedCard(null)}
          cardUrl={selectedCard.url}
          guestName={selectedCard.name}
          cardNumber={selectedCard.cardNumber}
        />
      )}
    </div>
  );
}