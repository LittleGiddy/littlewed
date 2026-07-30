'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Calendar, MapPin, Users, QrCode, MessageCircle, Phone, ArrowLeft,
  Upload, Plus, Palette, Send, Smartphone, CheckCircle, Trash2, CheckSquare,
  Square, ArrowUp, Heart, X, Image as ImageIcon, ExternalLink, Bell,
  Search, Download, User, Clock, AlertCircle, Timer, CalendarClock,
  AlarmClock, AlarmClockOff, RotateCw, Pencil
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';
import toast from 'react-hot-toast';

// ─── Guest type ──────────────────────────────────────────────────────────
interface Guest {
  id: string;
  name: string;
  phone: string;
  routingChannel: string;
  checkedIn: boolean;
  attending: string;
  invitationSentAt: string | null;
  thanksSentAt: string | null;
  reminderCount: number;
}

interface EventData {
  id: string;
  name: string;
  date: string;
  venue: string;
  address: string;
  commission_paid: boolean;
  thankYouCardUrl: string | null;
  tenant: { testMode: boolean };
  status: string;
  pausedAt: string | null;
  expiresAt: string | null;
  resumedAt: string | null;
  reminderSent: boolean;
  expiredNotified: boolean;
  resumedBy: string | null;
}

// ─── Countdown timer component (memoized) ──────────────────────────────
const EventCountdown = React.memo(({ targetDate, onStatusChange }: { targetDate: string; onStatusChange?: (status: string) => void }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [status, setStatus] = useState('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const target = useMemo(() => new Date(targetDate), [targetDate]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const update = () => {
      const now = new Date();
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        if (status !== 'LIVE') {
          setStatus('LIVE');
          if (onStatusChange) onStatusChange('LIVE');
        }
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
      setStatus(prev => {
        if (hours <= 24 && days === 0 && hours > 0) return 'REMINDER';
        return prev === 'LIVE' ? 'LIVE' : 'ACTIVE';
      });
    };

    update();
    intervalRef.current = setInterval(update, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [target, onStatusChange]);

  const formattedTime = `${String(timeLeft.days).padStart(2, '0')}d ${String(timeLeft.hours).padStart(2, '0')}h ${String(timeLeft.minutes).padStart(2, '0')}m ${String(timeLeft.seconds).padStart(2, '0')}s`;

  if (status === 'LIVE') {
    return (
      <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
        <AlarmClock size={16} className="animate-pulse" />
        <span className="font-bold text-sm">Event is happening now!</span>
      </div>
    );
  }

  if (status === 'REMINDER') {
    return (
      <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200 animate-pulse">
        <Timer size={16} />
        <span className="font-bold text-sm">{formattedTime}</span>
        <span className="text-xs font-medium">— Coming in 24 hours</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] px-3 py-1.5 rounded-full border border-[rgba(13,79,79,0.15)]">
      <CalendarClock size={16} />
      <span className="font-bold text-sm">{formattedTime}</span>
      <span className="text-xs font-medium text-gray-500">until event</span>
    </div>
  );
});

EventCountdown.displayName = 'EventCountdown';

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [eventId, setEventId] = useState<string | null>(null);
  const [event, setEvent] = useState<EventData | null>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [countdownKey, setCountdownKey] = useState(0);

  // ── Ref to prevent duplicate LIVE reports ──────────────────────────────
  const hasReportedLive = useRef(false);

  // ── Pagination & search ────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');

  // ── Backup modal ──────────────────────────────────────────────────────
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [allGuests, setAllGuests] = useState<Guest[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSearch, setBackupSearch] = useState('');
  const [backupPage, setBackupPage] = useState(1);

  // ── Existing modal states ─────────────────────────────────────────────
  const [showThanksModal, setShowThanksModal] = useState(false);
  const [thanksMessage, setThanksMessage] = useState('');
  const [sendingThanks, setSendingThanks] = useState(false);

  const [showKumbushaModal, setShowKumbushaModal] = useState(false);
  const [kumbushaMessage, setKumbushaMessage] = useState('');
  const [sendingKumbusha, setSendingKumbusha] = useState(false);

  // ─── Edit Event Modal ─────────────────────────────────────────────────
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    venue: '',
    address: '',
    date: '',
  });
  const [editing, setEditing] = useState(false);

  // ─── Resume event ──────────────────────────────────────────────────────
  const handleResumeEvent = async () => {
    if (!eventId) return;
    if (!confirm('Resume this event? It will become active again for 7 days.')) return;

    try {
      const res = await fetch(`/api/events/${eventId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Event resumed successfully!');
        fetchData(eventId);
        setCountdownKey(prev => prev + 1);
      } else {
        toast.error(data.error || 'Failed to resume event');
      }
    } catch {
      toast.error('Network error');
    }
  };

  // ─── Effects ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    params.then(({ id }) => {
      if (cancelled) return;
      setEventId(id);
      // Reset the live flag when event ID changes
      hasReportedLive.current = false;
      fetchData(id);
      fetchCredits();
    }).catch((err) => {
      console.error('Failed to resolve params:', err);
      setFetchError('Could not read event ID from URL.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [params]);

  // ─── Fetch data (stable via useCallback) ─────────────────────────────
  const fetchData = useCallback(async (id: string) => {
    setLoading(true); setFetchError(null);
    try {
      const res = await fetch(`/api/events/${id}`, { credentials: 'include' });
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try { const b = await res.json(); detail = b?.error || b?.message || detail; } catch { }
        throw new Error(detail);
      }
      const data = await res.json();
      if (!data?.event) throw new Error('Unexpected response format from server.');
      setEvent(data.event);
      setGuests(Array.isArray(data.guests) ? data.guests : []);
      setCurrentPage(1);
      // Reset the live flag if the event is not LIVE
      if (data.event.status !== 'LIVE') {
        hasReportedLive.current = false;
      }
    } catch (err: any) {
      const msg = err?.message ?? 'Unknown error';
      setFetchError(msg);
      toast.error(`Could not load event: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCredits = async () => {
    try {
      const res = await fetch('/api/tenant/billing', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setCredits(data.tenant?.credits ?? 0);
    } catch { }
  };

  // ─── Guest selection ──────────────────────────────────────────────────
  const toggleSelectAll = () => {
    if (selectedGuests.size === guests.length) setSelectedGuests(new Set());
    else setSelectedGuests(new Set(guests.map(g => g.id)));
  };

  const toggleSelectGuest = (id: string) => {
    const s = new Set(selectedGuests);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedGuests(s);
  };

  const deleteSelected = async () => {
    if (selectedGuests.size === 0) { toast.error('No guests selected'); return; }
    if (!confirm(`Delete ${selectedGuests.size} selected guest${selectedGuests.size > 1 ? 's' : ''}? This action cannot be undone.`)) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/guests/bulk-delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds: Array.from(selectedGuests) }), credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) { toast.success(`Deleted ${data.count} guest${data.count > 1 ? 's' : ''}`); setSelectedGuests(new Set()); fetchData(eventId!); }
      else toast.error(data.error || 'Failed to delete guests');
    } catch { toast.error('Network error'); }
    finally { setDeleting(false); }
  };

  const deleteGuest = async (guestId: string) => {
    if (!confirm('Delete this guest?')) return;
    try {
      const res = await fetch(`/api/guests/${guestId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) { toast.success('Guest deleted'); setGuests(prev => prev.filter(g => g.id !== guestId)); setSelectedGuests(prev => { const s = new Set(prev); s.delete(guestId); return s; }); }
      else { const data = await res.json(); toast.error(data.error || 'Failed to delete'); }
    } catch { toast.error('Network error'); }
  };

  // ─── Scroll to top ──────────────────────────────────────────────────
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => setShowBackToTop((e.target as HTMLDivElement).scrollTop > 300);
  const scrollToTop = () => document.getElementById('guest-list-container')?.scrollTo({ top: 0, behavior: 'smooth' });

  // ─── Filtered & paginated guests ──────────────────────────────────
  const filteredGuests = useMemo(() => {
    if (!searchTerm.trim()) return guests;
    const term = searchTerm.trim().toLowerCase();
    return guests.filter(g =>
      g.name.toLowerCase().includes(term) ||
      (g.phone && g.phone.includes(term))
    );
  }, [guests, searchTerm]);

  const totalPages = Math.ceil(filteredGuests.length / pageSize);
  const paginatedGuests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredGuests.slice(start, start + pageSize);
  }, [filteredGuests, currentPage, pageSize]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    const container = document.getElementById('guest-list-container');
    if (container) container.scrollTop = 0;
  };

  // ─── Backup guests modal ────────────────────────────────────────────
  const openBackupModal = async () => {
    setShowBackupModal(true);
    if (allGuests.length === 0 && !backupLoading) {
      setBackupLoading(true);
      try {
        const res = await fetch('/api/guests/all', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          setAllGuests(data.guests || []);
        } else {
          toast.error('Failed to load all guests');
        }
      } catch {
        toast.error('Network error');
      } finally {
        setBackupLoading(false);
      }
    }
  };

  const filteredBackup = useMemo(() => {
    if (!backupSearch.trim()) return allGuests;
    const term = backupSearch.trim().toLowerCase();
    return allGuests.filter(g => g.name.toLowerCase().includes(term) || (g.phone && g.phone.includes(term)));
  }, [allGuests, backupSearch]);

  const backupTotalPages = Math.ceil(filteredBackup.length / pageSize);
  const backupPaginated = useMemo(() => {
    const start = (backupPage - 1) * pageSize;
    return filteredBackup.slice(start, start + pageSize);
  }, [filteredBackup, backupPage, pageSize]);

  // ─── Kumbusha / Thanks logic ──────────────────────────────────────────
  const whatsappCheckedInGuests = guests.filter(g => g.checkedIn && g.routingChannel === 'whatsapp');
  const checkedInCount = whatsappCheckedInGuests.length;

  const openThanksModal = () => {
    if (checkedInCount === 0) { toast.error('No WhatsApp‑checked‑in guests to thank.'); return; }
    setThanksMessage(`Thank you for attending ${event?.name}! We hope you enjoyed the event.`);
    setShowThanksModal(true);
  };

  const sendThanks = async () => {
    if (!thanksMessage.trim()) { toast.error('Please enter a thank‑you message.'); return; }
    const totalCost = checkedInCount * 300;
    if (credits !== null && credits < totalCost) { toast.error(`Insufficient credits. Need ${totalCost} TZS, you have ${credits} TZS.`); return; }
    if (!confirm(`Send thank‑you to ${checkedInCount} WhatsApp guest${checkedInCount > 1 ? 's' : ''}? This will cost ${totalCost} TZS.`)) return;
    setSendingThanks(true);
    let successCount = 0; const errors: string[] = [];
    for (const guest of whatsappCheckedInGuests) {
      try {
        const res = await fetch('/api/invitations/send-whatsapp', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId: guest.id, eventId, message: thanksMessage, type: 'thanks' }), credentials: 'include',
        });
        const data = await res.json();
        if (res.ok) successCount++; else errors.push(`${guest.name}: ${data.error || 'Unknown error'}`);
      } catch { errors.push(`${guest.name}: Network error`); }
      await new Promise(r => setTimeout(r, 300));
    }
    if (errors.length === 0) toast.success(`Thank‑you sent to ${successCount} of ${checkedInCount} guests.`);
    else toast.error(`Sent ${successCount}/${checkedInCount}. Errors: ${errors.join(', ')}`);
    setSendingThanks(false); setShowThanksModal(false);
    fetchCredits(); fetchData(eventId!);
  };

  const kumbushaGuests = guests.filter(g => !g.checkedIn && g.routingChannel === 'sms');
  const kumbushaCount = kumbushaGuests.length;
  const kumbushaTotalCost = kumbushaGuests.reduce((sum, g) => sum + (g.reminderCount < 2 ? 0 : 50), 0);
  const isFree = kumbushaTotalCost === 0;

  const openKumbushaModal = () => {
    if (kumbushaCount === 0) { toast.error('No SMS guests pending check-in.'); return; }
    setKumbushaMessage(`Karibu ${event?.name}! Tafadhali kumbuka kuleta mchango wako.`);
    setShowKumbushaModal(true);
  };

  const sendKumbusha = async () => {
    if (!kumbushaMessage.trim()) { toast.error('Andika ujumbe wa kukumbusha.'); return; }
    if (kumbushaTotalCost > 0 && credits !== null && credits < kumbushaTotalCost) { toast.error(`Mikopo haitoshi. Unahitaji ${kumbushaTotalCost} TZS, una ${credits} TZS.`); return; }
    const costText = isFree ? 'bure' : `${kumbushaTotalCost} TZS`;
    if (!confirm(`Tuma ukumbusho kwa wageni ${kumbushaCount}? Gharama: ${costText}.`)) return;
    setSendingKumbusha(true);
    try {
      const res = await fetch(`/api/events/${eventId}/send-reminders`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds: kumbushaGuests.map(g => g.id), message: kumbushaMessage }), credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        if (data.successCount === kumbushaGuests.length) toast.success(`Ukumbusho ulitumwa kwa wageni ${data.successCount} wote.`);
        else { toast.success(`Ukumbusho ulitumwa kwa ${data.successCount} kati ya ${kumbushaGuests.length} wageni.`); if (data.errors?.length) toast.error('Baadhi ya ujumbe haukutuma.'); }
        fetchCredits(); fetchData(eventId!); setShowKumbushaModal(false);
      } else { toast.error('Imeshindwa kutuma ukumbusho.'); }
    } catch { toast.error('Tatizo la mtandao. Tafadhali jaribu tena.'); }
    finally { setSendingKumbusha(false); }
  };

  // ─── Edit Event handlers ──────────────────────────────────────────────
  const openEditModal = () => {
    if (!event) return;

    // Parse the UTC date and convert to local for display
    const eventDate = new Date(event.date);

    // Format for datetime-local input (local time)
    const year = eventDate.getFullYear();
    const month = String(eventDate.getMonth() + 1).padStart(2, '0');
    const day = String(eventDate.getDate()).padStart(2, '0');
    const hours = String(eventDate.getHours()).padStart(2, '0');
    const minutes = String(eventDate.getMinutes()).padStart(2, '0');
    const localDateStr = `${year}-${month}-${day}T${hours}:${minutes}`;

    setEditForm({
      name: event.name,
      venue: event.venue,
      address: event.address || '',
      date: localDateStr,
    });
    setShowEditModal(true);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditing(true);
    try {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          venue: editForm.venue,
          address: editForm.address,
          date: editForm.date,
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Event updated successfully!');
        setShowEditModal(false);
        fetchData(eventId!);
        setCountdownKey(prev => prev + 1);
      } else {
        toast.error(data.error || 'Failed to update event');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setEditing(false);
    }
  };

  // ─── Stable status change handler ─────────────────────────────────────
  const handleStatusChange = useCallback((newStatus: string) => {
    if (newStatus === 'LIVE' && !hasReportedLive.current) {
      hasReportedLive.current = true;
      fetchData(eventId!);
    }
  }, [fetchData, eventId]);

  // ─── Memoize event date ──────────────────────────────────────────────
  const eventDate = useMemo(() => event ? new Date(event.date) : null, [event?.date]);

  // ─── Render helpers ──────────────────────────────────────────────────
  const renderGuestCard = (guest: Guest) => {
    const isSelected = selectedGuests.has(guest.id);
    const isWhatsApp = guest.routingChannel === 'whatsapp';
    const isCheckedIn = guest.checkedIn;
    const hasThanks = guest.thanksSentAt;
    const reminderCount = guest.reminderCount;

    return (
      <div
        key={guest.id}
        className={`bg-white rounded-xl border transition-all hover:shadow-md ${isSelected ? 'border-[#0D4F4F] shadow-md' : 'border-gray-100'}`}
        style={{ transition: 'all 0.15s' }}
      >
        <div className="flex items-center p-3 gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelectGuest(guest.id)}
            className="w-4 h-4 rounded border-gray-300 text-[#0D4F4F] focus:ring-[#0D4F4F] flex-shrink-0"
          />
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0D4F4F] to-[#0A3D3D] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {guest.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-800 text-sm truncate">{guest.name}</p>
              {isCheckedIn && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                  <CheckCircle size={12} /> Checked In
                </span>
              )}
              {hasThanks && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full">
                  <Heart size={12} /> Thanks
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${isWhatsApp ? 'bg-[rgba(13,79,79,0.08)] text-[#0D4F4F]' : 'bg-gray-100 text-gray-600'}`}>
                {isWhatsApp ? <MessageCircle size={11} /> : <Phone size={11} />}
                {isWhatsApp ? 'WhatsApp' : 'SMS'}
              </span>
              {guest.phone && (
                <span className="text-xs text-gray-400 font-mono truncate">{guest.phone}</span>
              )}
              {reminderCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                  <Clock size={11} /> {reminderCount} reminder{reminderCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {event?.tenant?.testMode && (
              <Link href={`/invite/preview/${guest.id}`} target="_blank" className="p-1.5 text-gray-400 hover:text-[#0D4F4F] transition rounded">
                <ExternalLink size={15} />
              </Link>
            )}
            <button
              onClick={() => deleteGuest(guest.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 transition rounded"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Loading state ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-[#0D4F4F] rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading event…</p>
      </div>
    );
  }

  if (fetchError || !event) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h1 className="font-serif text-2xl font-bold text-gray-800 mb-2">{fetchError ? 'Failed to Load Event' : 'Event Not Found'}</h1>
          <p className="text-gray-500 text-sm mb-5">{fetchError ?? "This event doesn't exist or you don't have access to it."}</p>
          <div className="flex gap-3 justify-center">
            {fetchError && eventId && (
              <button onClick={() => fetchData(eventId)} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white text-sm font-bold rounded-xl hover:shadow-md transition">
                <ArrowLeft size={14} /> Retry
              </button>
            )}
            <Link href="/client/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-bold rounded-xl hover:bg-gray-50 transition">
              <ArrowLeft size={14} /> Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Stats ──────────────────────────────────────────────────────────
  const whatsappCount = guests.filter(g => g.routingChannel === 'whatsapp').length;
  const smsCount = guests.filter(g => g.routingChannel === 'sms').length;
  const checkedInAll = guests.filter(g => g.checkedIn).length;

  // ─── Event Status Helpers ──────────────────────────────────────────
  const isExpired = event.status === 'EXPIRED';
  const isArchived = event.status === 'ARCHIVED';
  const isLive = event.status === 'LIVE';
  const isActive = event.status === 'ACTIVE' || event.status === 'LIVE';
  const isDraft = event.status === 'DRAFT';

  const canResume = isExpired && event.pausedAt && differenceInHours(new Date(), new Date(event.pausedAt)) < 168;
  const daysRemainingToResume = isExpired && event.pausedAt
    ? Math.max(0, 7 - differenceInHours(new Date(), new Date(event.pausedAt)) / 24)
    : 0;

  const getStatusBadge = () => {
    if (isArchived) {
      return {
        icon: <AlarmClockOff size={16} />,
        label: 'Archived',
        className: 'bg-gray-100 text-gray-600 border-gray-200'
      };
    }
    if (isExpired) {
      if (canResume) {
        return {
          icon: <Timer size={16} />,
          label: `Paused (${daysRemainingToResume.toFixed(0)} days left to resume)`,
          className: 'bg-amber-50 text-amber-700 border-amber-200'
        };
      }
      return {
        icon: <AlarmClockOff size={16} />,
        label: 'Expired (cannot resume)',
        className: 'bg-red-50 text-red-700 border-red-200'
      };
    }
    if (isLive) {
      return {
        icon: <AlarmClock size={16} className="animate-pulse" />,
        label: 'Live Now!',
        className: 'bg-green-50 text-green-700 border-green-200'
      };
    }
    if (isActive) {
      const hoursUntil = differenceInHours(new Date(event.date), new Date());
      if (hoursUntil <= 24 && hoursUntil > 0) {
        return {
          icon: <Timer size={16} className="animate-pulse" />,
          label: 'Coming in 24 hours',
          className: 'bg-amber-50 text-amber-700 border-amber-200'
        };
      }
      return {
        icon: <CalendarClock size={16} />,
        label: `Active (${formatDistanceToNow(new Date(event.date), { addSuffix: true })})`,
        className: 'bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border-[rgba(13,79,79,0.15)]'
      };
    }
    if (isDraft) {
      return {
        icon: <AlertCircle size={16} />,
        label: 'Draft',
        className: 'bg-gray-100 text-gray-500 border-gray-200'
      };
    }
    return {
      icon: <AlertCircle size={16} />,
      label: event.status || 'Unknown',
      className: 'bg-gray-100 text-gray-500 border-gray-200'
    };
  };

  const statusBadge = getStatusBadge();

  // ─── Check if event is disabled ────────────────────────────────────
  const isEventDisabled = isExpired || isArchived;

  return (
    <>
      <style>{`
        /* ── Themed Modal styles ── */
        .tm-overlay { position: fixed; inset: 0; background: rgba(13,27,27,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px; animation: tmOverlayIn 0.18s ease both; }
        @keyframes tmOverlayIn { from { opacity: 0; } to { opacity: 1; } }
        .tm-modal { background: white; border-radius: 24px; width: 100%; max-width: 460px; max-height: 92vh; overflow-y: auto; scrollbar-width: none; box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 40px 80px rgba(0,0,0,0.1); font-family: 'DM Sans', 'Segoe UI', sans-serif; animation: tmModalIn 0.32s cubic-bezier(0.16,1,0.3,1) both; }
        .tm-modal::-webkit-scrollbar { display: none; }
        @keyframes tmModalIn { from { opacity: 0; transform: translateY(24px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .tm-bar { height: 4px; border-radius: 24px 24px 0 0; }
        .tm-bar.teal { background: linear-gradient(90deg, #0D4F4F, #E8A598); }
        .tm-bar.amber { background: linear-gradient(90deg, #C07A20, #E8A598); }
        .tm-bar.salmon { background: linear-gradient(90deg, #E8A598, #D4857A); }
        .tm-head { display: flex; align-items: flex-start; justify-content: space-between; padding: 20px 24px 16px; }
        .tm-eyebrow { font-size: 10.5px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
        .tm-eyebrow-dot { width: 4px; height: 4px; border-radius: 50%; background: #E8A598; }
        .tm-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 900; color: #0D1B1B; line-height: 1.15; letter-spacing: -0.3px; margin: 0; }
        .tm-title span { color: #E8A598; }
        .tm-close { width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid #E2EAF0; background: white; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #9BAAB8; flex-shrink: 0; margin-top: 2px; transition: border-color 0.15s, color 0.15s; }
        .tm-close:hover { border-color: #C0392B; color: #C0392B; }
        .tm-body { padding: 0 24px 24px; }
        .tm-info-row { display: flex; align-items: center; gap: 10px; background: rgba(13,79,79,0.04); border: 1.5px solid rgba(13,79,79,0.1); border-radius: 13px; padding: 12px 14px; margin-bottom: 10px; }
        .tm-info-icon { width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0; background: rgba(13,79,79,0.1); display: flex; align-items: center; justify-content: center; color: #0D4F4F; }
        .tm-info-label { font-size: 11px; color: #9BAAB8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; }
        .tm-info-value { font-size: 14px; font-weight: 700; color: #0D1B1B; }
        .tm-cost-row { display: flex; align-items: center; gap: 10px; border-radius: 13px; padding: 12px 14px; margin-bottom: 16px; }
        .tm-cost-row.free { background: rgba(26,122,74,0.06); border: 1.5px solid rgba(26,122,74,0.18); }
        .tm-cost-row.paid { background: rgba(192,122,32,0.06); border: 1.5px solid rgba(192,122,32,0.2); }
        .tm-cost-icon { width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 16px; }
        .tm-cost-text { font-size: 13px; font-weight: 600; line-height: 1.5; }
        .tm-cost-row.free .tm-cost-text { color: #1A7A4A; }
        .tm-cost-row.paid .tm-cost-text { color: #92580A; }
        .tm-cost-balance { font-size: 11px; color: #9BAAB8; margin-top: 2px; }
        .tm-field-label { font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #9BAAB8; margin-bottom: 8px; display: block; }
        .tm-textarea { width: 100%; padding: 14px 16px; border: 1.5px solid #E2EAF0; border-radius: 13px; font-size: 14px; font-family: inherit; color: #0D1B1B; font-weight: 500; resize: none; outline: none; line-height: 1.6; transition: border-color 0.2s, box-shadow 0.2s; }
        .tm-textarea:focus { border-color: #0D4F4F; box-shadow: 0 0 0 4px rgba(13,79,79,0.08); }
        .tm-char-count { font-size: 11px; color: #C8D4DE; text-align: right; margin-top: 5px; }
        .tm-card-preview { border: 1.5px solid #E2EAF0; border-radius: 13px; overflow: hidden; margin-bottom: 16px; }
        .tm-card-preview img { width: 100%; max-height: 180px; object-fit: contain; display: block; background: #F7F9FB; }
        .tm-card-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px; text-align: center; background: #F7F9FB; color: #9BAAB8; gap: 8px; font-size: 13px; font-weight: 600; }
        .tm-divider { height: 1px; background: #F0F4F8; margin: 18px 0; }
        .tm-actions { display: flex; gap: 10px; }
        .tm-cancel-btn { padding: 13px 18px; border-radius: 13px; border: 1.5px solid #E2EAF0; background: white; color: #4A6072; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; white-space: nowrap; transition: border-color 0.15s, color 0.15s; }
        .tm-cancel-btn:hover { border-color: #0D4F4F; color: #0D4F4F; }
        .tm-send-btn { flex: 1; padding: 13px; border-radius: 13px; border: none; color: white; font-size: 14.5px; font-weight: 700; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(0,0,0,0.15); transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s; position: relative; overflow: hidden; }
        .tm-send-btn::after { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent); opacity: 0; transition: opacity 0.2s; }
        .tm-send-btn:hover:not(:disabled)::after { opacity: 1; }
        .tm-send-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(0,0,0,0.22); }
        .tm-send-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .tm-send-btn.teal { background: linear-gradient(135deg, #0D4F4F, #0A3D3D); }
        .tm-send-btn.amber { background: linear-gradient(135deg, #C07A20, #A86418); }
        .tm-send-btn.salmon { background: linear-gradient(135deg, #E8A598, #D4857A); }
        .tm-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: tmSpin 0.7s linear infinite; flex-shrink: 0; }
        @keyframes tmSpin { to { transform: rotate(360deg); } }

        .kumbusha-btn { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 18px; background: white; border: 1.5px solid rgba(192,122,32,0.3); border-radius: 14px; cursor: pointer; font-family: inherit; width: 100%; transition: border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s; text-align: left; }
        .kumbusha-btn:hover { border-color: #C07A20; background: rgba(192,122,32,0.03); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(192,122,32,0.1); }
        .kumbusha-btn-left { display: flex; align-items: center; gap: 12px; }
        .kumbusha-btn-icon { width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0; background: rgba(192,122,32,0.1); border: 1px solid rgba(192,122,32,0.2); display: flex; align-items: center; justify-content: center; color: #C07A20; }
        .kumbusha-btn-title { font-size: 14px; font-weight: 700; color: #0D1B1B; }
        .kumbusha-btn-sub { font-size: 12px; color: #9BAAB8; font-weight: 500; margin-top: 1px; }
        .kumbusha-btn-badge { font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; background: rgba(192,122,32,0.1); color: #C07A20; border: 1px solid rgba(192,122,32,0.2); }
        .kumbusha-btn-badge.free { background: rgba(26,122,74,0.08); color: #1A7A4A; border-color: rgba(26,122,74,0.18); }

        .field-wrap { margin-bottom: 16px; }
        .field-input { width: 100%; padding: 12px 14px; border: 1.5px solid #E2EAF0; border-radius: 11px; font-size: 14px; font-family: inherit; outline: none; color: #0D1B1B; background: white; font-weight: 500; transition: border-color 0.2s, box-shadow 0.2s; }
        .field-input:focus { border-color: #0D4F4F; box-shadow: 0 0 0 4px rgba(13,79,79,0.08); }
        .field-label { display: block; font-size: 13px; font-weight: 600; color: #4A6072; margin-bottom: 5px; }
      `}</style>

      <div className="max-w-4xl mx-auto">
        {/* ─── Top nav ────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link href="/client/dashboard" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] rounded-xl px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.14)]">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-2">
            {!isArchived && (
              <button
                onClick={openEditModal}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.15)] rounded-xl px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.15)]"
              >
                <Pencil size={14} /> Edit Event
              </button>
            )}
            {isEventDisabled && canResume && (
              <button
                onClick={handleResumeEvent}
                className="inline-flex items-center gap-1.5 text-sm font-bold text-green-700 bg-green-50 border border-green-200 rounded-xl px-3.5 py-1.5 transition hover:bg-green-100"
              >
                <RotateCw size={14} /> Resume Event
              </button>
            )}
            <button
              onClick={async () => {
                if (!confirm('Delete this event and ALL its guests? This action cannot be undone.')) return;
                const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE', credentials: 'include' });
                if (res.ok) { toast.success('Event deleted'); router.push('/client/events'); }
                else { const data = await res.json(); toast.error(data.error || 'Failed to delete event'); }
              }}
              className="inline-flex items-center gap-1.5 text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-1.5 transition hover:bg-red-100"
            >
              <Trash2 size={14} /> Delete Event
            </button>
          </div>
        </div>

        {/* ─── Event header ────────────────────────────────────────────── */}
        <div className="mb-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-serif text-3xl md:text-4xl font-black text-gray-900 leading-tight tracking-tight">
                  {event.name}
                </h1>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border ${statusBadge.className}`}>
                  {statusBadge.icon}
                  {statusBadge.label}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-2">
                <div className="flex items-center gap-1.5">
                  <Calendar size={16} className="text-[#0D4F4F]" />
                  {format(new Date(event.date), 'PPP')}
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin size={16} className="text-[#0D4F4F]" />
                  {event.venue}
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-1">{event.address}</p>
            </div>

            {!isEventDisabled && eventDate && (
              <div className="flex-shrink-0">
                <EventCountdown
                  key={countdownKey}
                  targetDate={event.date}
                  onStatusChange={handleStatusChange}
                />
              </div>
            )}

            {isExpired && (
              <div className="flex-shrink-0 bg-red-50 border border-red-200 rounded-xl px-4 py-2">
                <p className="text-sm font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle size={16} />
                  {canResume
                    ? `This event is paused. You have ${daysRemainingToResume.toFixed(0)} days left to resume it.`
                    : 'This event has been permanently archived and cannot be resumed.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ─── Stats ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
          {[
            { icon: <Users size={18} />, value: guests.length, label: 'Total Guests', bg: 'rgba(13,79,79,0.08)', color: '#0D4F4F' },
            { icon: <Smartphone size={18} />, value: checkedInAll, label: 'Checked In', bg: '#EDFAF4', color: '#1A7A4A' },
            { icon: <MessageCircle size={18} />, value: whatsappCount, label: 'WhatsApp', bg: '#EAF4F4', color: '#0D4F4F' },
            { icon: <Phone size={18} />, value: smsCount, label: 'SMS', bg: '#FEF6EC', color: '#C07A20' },
          ].map(({ icon, value, label, bg, color }) => (
            <div key={label} className={`bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition border border-[#F0F4F8] ${isEventDisabled ? 'opacity-60' : ''}`}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2" style={{ background: bg, color }}>{icon}</div>
              <div className="font-serif text-2xl font-black text-gray-800">{value}</div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</div>
            </div>
          ))}
        </div>

        {/* ─── Action buttons ────────────────────────────────────────────── */}
        {isEventDisabled ? (
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center mb-7">
            <AlertCircle size={24} className="text-gray-400 mx-auto mb-2" />
            <p className="text-gray-500 font-medium">
              This event is {event.status === 'ARCHIVED' ? 'archived' : 'paused'}. All actions are disabled.
              {canResume && ' You can resume it using the Resume button above.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-7">
            <Link href={`/client/invitations/send/${event.id}`} className="col-span-full bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white text-center py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2">
              <Send size={15} /> Send Invitations
            </Link>

            <div className="col-span-full">
              <button className="kumbusha-btn" onClick={openKumbushaModal}>
                <div className="kumbusha-btn-left">
                  <div className="kumbusha-btn-icon"><Bell size={18} /></div>
                  <div>
                    <div className="kumbusha-btn-title">Kumbusha Michango</div>
                    <div className="kumbusha-btn-sub">{kumbushaCount} SMS guest{kumbushaCount !== 1 ? 's' : ''} pending check-in</div>
                  </div>
                </div>
                <span className={`kumbusha-btn-badge${isFree ? ' free' : ''}`}>
                  {isFree ? '✓ Free' : `${kumbushaTotalCost} TZS`}
                </span>
              </button>
            </div>

            <Link href={`/client/guests/import/${event.id}`} className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] text-center py-2.5 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2">
              <Upload size={14} /> Import Guests
            </Link>
            <Link href={`/client/guests/add/${event.id}`} className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] text-center py-2.5 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2">
              <Plus size={14} /> Add Guest
            </Link>
            <Link href={`/client/invitations/design/${event.id}`} className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] text-center py-2.5 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2">
              <Palette size={14} /> Design Card
            </Link>
            <Link href={`/client/check-in?event=${event.id}`} className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] text-center py-2.5 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2">
              <QrCode size={14} /> Check-In
            </Link>

            {checkedInCount > 0 && (
              <button onClick={openThanksModal} className="col-span-full bg-gradient-to-r from-[#E8A598] to-[#D4857A] text-white text-center py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2">
                <Heart size={15} /> Send Thanks ({checkedInCount} WhatsApp checked‑in)
              </button>
            )}
          </div>
        )}

        {/* ─── Guest List ─── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <h2 className="font-serif text-lg font-extrabold text-gray-800">Guest List</h2>
              <span className="text-[11px] font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] px-2.5 py-1 rounded-full">
                {guests.length} guest{guests.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                  placeholder="Search guests…"
                  className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent w-40 md:w-56"
                />
              </div>

              <Link href="/client/guests/backup" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] px-3 py-1.5 rounded-lg hover:bg-[rgba(13,79,79,0.14)] transition">
                <Download size={14} /> Backup
              </Link>

              {!isEventDisabled && (
                <>
                  <button onClick={toggleSelectAll} className="text-sm text-gray-600 hover:text-[#0D4F4F] flex items-center gap-1 whitespace-nowrap">
                    {selectedGuests.size === guests.length ? <CheckSquare size={16} /> : <Square size={16} />}
                    {selectedGuests.size === guests.length ? 'Deselect All' : 'Select All'}
                  </button>
                  {selectedGuests.size > 0 && (
                    <button onClick={deleteSelected} disabled={deleting} className="text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg transition disabled:opacity-50 flex items-center gap-1">
                      {deleting ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={14} />}
                      Delete ({selectedGuests.size})
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {guests.length === 0 ? (
            <div className="py-12 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-serif text-lg font-bold text-gray-800 mb-1">No guests yet</h3>
              <p className="text-sm text-gray-400">Import a guest list or add guests manually to get started.</p>
            </div>
          ) : (
            <div>
              <div id="guest-list-container" className={`divide-y divide-gray-100 max-h-96 overflow-y-auto scroll-smooth p-2 ${isEventDisabled ? 'opacity-60' : ''}`} onScroll={handleScroll}>
                <div className="grid grid-cols-1 gap-2">
                  {paginatedGuests.map(renderGuestCard)}
                </div>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                  <div className="text-sm text-gray-500">
                    Showing {(currentPage - 1) * pageSize + 1} – {Math.min(currentPage * pageSize, filteredGuests.length)} of {filteredGuests.length}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
                    >
                      Previous
                    </button>
                    <span className="px-3 py-1 text-sm font-semibold text-gray-700">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {showBackToTop && (
                <button onClick={scrollToTop} className="absolute bottom-3 right-3 bg-[#0D4F4F] text-white p-2 rounded-full shadow-lg hover:bg-[#0A3D3D] transition z-10">
                  <ArrowUp size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Kumbusha Modal ─── */}
      {showKumbushaModal && (
        <div className="tm-overlay" onClick={e => { if (e.target === e.currentTarget) setShowKumbushaModal(false); }}>
          <div className="tm-modal">
            <div className="tm-bar amber" />
            <div className="tm-head">
              <div>
                <div className="tm-eyebrow" style={{ color: '#C07A20' }}>
                  <div className="tm-eyebrow-dot" /> Ukumbusho
                </div>
                <h2 className="tm-title">Kumbusha <span>Michango</span></h2>
              </div>
              <button className="tm-close" onClick={() => setShowKumbushaModal(false)}><X size={15} /></button>
            </div>
            <div className="tm-body">
              <div className="tm-info-row">
                <div className="tm-info-icon"><Users size={16} /></div>
                <div>
                  <div className="tm-info-label">Wageni waliopo</div>
                  <div className="tm-info-value">{kumbushaCount} SMS guest{kumbushaCount !== 1 ? 's' : ''} (hawajafika)</div>
                </div>
              </div>

              <div className={`tm-cost-row ${isFree ? 'free' : 'paid'}`}>
                <div className="tm-cost-icon">{isFree ? '✅' : '💰'}</div>
                <div>
                  <div className="tm-cost-text">
                    {isFree
                      ? 'Kumbusho 2 za kwanza hazina gharama kwa kila mgeni'
                      : `Gharama: ${kumbushaTotalCost} TZS (50 TZS/mgeni baada ya 2 za bure)`}
                  </div>
                  {credits !== null && <div className="tm-cost-balance">Salio liililobaki: {credits} TZS</div>}
                </div>
              </div>

              <div className="tm-divider" />
              <label className="tm-field-label">Ujumbe wa kukumbusha</label>
              <textarea
                className="tm-textarea"
                rows={4}
                value={kumbushaMessage}
                onChange={e => setKumbushaMessage(e.target.value)}
                placeholder="Andika ujumbe hapa..."
              />
              <div className="tm-char-count">{kumbushaMessage.length} herufi</div>

              <div className="tm-actions" style={{ marginTop: 16 }}>
                <button className="tm-cancel-btn" onClick={() => setShowKumbushaModal(false)}>Ghairi</button>
                <button
                  className="tm-send-btn amber"
                  onClick={sendKumbusha}
                  disabled={sendingKumbusha || !kumbushaMessage.trim() || (kumbushaTotalCost > 0 && credits !== null && credits < kumbushaTotalCost)}
                >
                  {sendingKumbusha ? <><div className="tm-spinner" /> Inatuma…</> : <><Bell size={15} /> Tuma Ukumbusho</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Thanks Modal ─── */}
      {showThanksModal && (
        <div className="tm-overlay" onClick={e => { if (e.target === e.currentTarget) setShowThanksModal(false); }}>
          <div className="tm-modal">
            <div className="tm-bar salmon" />
            <div className="tm-head">
              <div>
                <div className="tm-eyebrow" style={{ color: '#D4857A' }}>
                  <div className="tm-eyebrow-dot" /> Shukrani
                </div>
                <h2 className="tm-title">Tuma <span>Shukrani</span></h2>
              </div>
              <button className="tm-close" onClick={() => setShowThanksModal(false)}><X size={15} /></button>
            </div>
            <div className="tm-body">
              <div className="tm-info-row">
                <div className="tm-info-icon"><Users size={16} /></div>
                <div>
                  <div className="tm-info-label">Wageni wa kupokea</div>
                  <div className="tm-info-value">{checkedInCount} WhatsApp guest{checkedInCount > 1 ? 's' : ''} (checked in)</div>
                </div>
              </div>

              <div className="tm-cost-row paid">
                <div className="tm-cost-icon">💰</div>
                <div>
                  <div className="tm-cost-text">Gharama: {checkedInCount * 300} TZS (300 TZS/mgeni)</div>
                  {credits !== null && <div className="tm-cost-balance">Mikopo iliyobaki: {credits} TZS</div>}
                </div>
              </div>

              <label className="tm-field-label" style={{ marginBottom: 8 }}>Kadi ya Shukrani</label>
              <div className="tm-card-preview" style={{ marginBottom: 16 }}>
                {event.thankYouCardUrl
                  ? <img src={event.thankYouCardUrl} alt="Thanks Card" />
                  : <div className="tm-card-empty"><ImageIcon size={28} /><span>Hakuna kadi ya shukrani. Wasiliana na msimamizi.</span></div>
                }
              </div>

              <div className="tm-divider" />
              <label className="tm-field-label">Ujumbe wa shukrani</label>
              <textarea
                className="tm-textarea"
                rows={4}
                value={thanksMessage}
                onChange={e => setThanksMessage(e.target.value)}
                placeholder="Andika ujumbe wa shukrani..."
              />
              <div className="tm-char-count">{thanksMessage.length} herufi</div>

              <div className="tm-actions" style={{ marginTop: 16 }}>
                <button className="tm-cancel-btn" onClick={() => setShowThanksModal(false)}>Ghairi</button>
                <button
                  className="tm-send-btn salmon"
                  onClick={sendThanks}
                  disabled={sendingThanks || !thanksMessage.trim() || (credits !== null && credits < checkedInCount * 300) || !event.thankYouCardUrl}
                >
                  {sendingThanks ? <><div className="tm-spinner" /> Inatuma…</> : <><Heart size={15} /> Tuma Shukrani</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Backup Guests Modal ────────────────────────────────────── */}
      {showBackupModal && (
        <div className="tm-overlay" onClick={e => { if (e.target === e.currentTarget) setShowBackupModal(false); }}>
          <div className="tm-modal" style={{ maxWidth: '640px' }}>
            <div className="tm-bar teal" />
            <div className="tm-head">
              <div>
                <div className="tm-eyebrow">
                  <div className="tm-eyebrow-dot" /> Backup
                </div>
                <h2 className="tm-title">All Guests <span>Across All Events</span></h2>
              </div>
              <button className="tm-close" onClick={() => setShowBackupModal(false)}><X size={15} /></button>
            </div>
            <div className="tm-body">
              {backupLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 border-4 border-gray-200 border-t-[#0D4F4F] rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  <div className="relative mb-4">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={backupSearch}
                      onChange={(e) => { setBackupSearch(e.target.value); setBackupPage(1); }}
                      placeholder="Search all guests…"
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                    />
                  </div>

                  {backupPaginated.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>No guests found</p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
                      {backupPaginated.map(g => (
                        <div key={g.id} className="py-2 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#0D4F4F]/10 flex items-center justify-center text-[#0D4F4F] font-bold text-sm flex-shrink-0">
                            {g.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-800">{g.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span>{g.phone || 'No phone'}</span>
                              <span>•</span>
                              <span className={`inline-flex items-center gap-1 ${g.checkedIn ? 'text-green-600' : 'text-amber-600'}`}>
                                {g.checkedIn ? <CheckCircle size={12} /> : <Clock size={12} />}
                                {g.checkedIn ? 'Checked in' : 'Pending'}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-24">
                            {g.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {backupTotalPages > 1 && (
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-400">
                        {filteredBackup.length} guest{filteredBackup.length !== 1 ? 's' : ''}
                      </span>
                      <div className="flex gap-1">
                        <button
                          onClick={() => setBackupPage(p => Math.max(1, p - 1))}
                          disabled={backupPage === 1}
                          className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1 text-sm font-semibold text-gray-700">{backupPage} / {backupTotalPages}</span>
                        <button
                          onClick={() => setBackupPage(p => Math.min(backupTotalPages, p + 1))}
                          disabled={backupPage === backupTotalPages}
                          className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Event Modal ──────────────────────────────────────────── */}
      {showEditModal && (
        <div className="tm-overlay" onClick={e => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
          <div className="tm-modal" style={{ maxWidth: '520px' }}>
            <div className="tm-bar teal" />
            <div className="tm-head">
              <div>
                <div className="tm-eyebrow"><div className="tm-eyebrow-dot" /> Edit Event</div>
                <h2 className="tm-title">Update <span>Event Details</span></h2>
              </div>
              <button className="tm-close" onClick={() => setShowEditModal(false)}><X size={15} /></button>
            </div>
            <div className="tm-body">
              <form onSubmit={handleEditSubmit}>
                <div className="field-wrap">
                  <label className="field-label">Event Name</label>
                  <input
                    type="text"
                    name="name"
                    value={editForm.name}
                    onChange={handleEditChange}
                    className="field-input"
                    required
                  />
                </div>
                <div className="field-wrap">
                  <label className="field-label">Venue</label>
                  <input
                    type="text"
                    name="venue"
                    value={editForm.venue}
                    onChange={handleEditChange}
                    className="field-input"
                    required
                  />
                </div>
                <div className="field-wrap">
                  <label className="field-label">Address</label>
                  <input
                    type="text"
                    name="address"
                    value={editForm.address}
                    onChange={handleEditChange}
                    className="field-input"
                  />
                </div>
                <div className="field-wrap">
                  <label className="field-label">Date & Time</label>
                  <input
                    type="datetime-local"
                    name="date"
                    value={editForm.date}
                    onChange={handleEditChange}
                    className="field-input"
                    required
                  />
                </div>
                <div className="tm-actions" style={{ marginTop: '8px' }}>
                  <button type="button" className="tm-cancel-btn" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button
                    type="submit"
                    className="tm-send-btn teal"
                    disabled={editing}
                  >
                    {editing ? <><div className="tm-spinner" /> Saving…</> : <>Save Changes</>}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}