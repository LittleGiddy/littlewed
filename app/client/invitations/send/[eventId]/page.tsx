'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Calendar, MapPin, Users, QrCode, MessageCircle, Phone, ArrowLeft,
  Upload, Plus, Palette, Send, Smartphone, CheckCircle, Trash2, CheckSquare,
  Square, ArrowUp, Heart, X, Image as ImageIcon, ExternalLink, Bell,
  Search, Download, User, Clock, AlertCircle, Timer, CalendarClock,
  AlarmClock, AlarmClockOff, RotateCw, Pencil, Edit2, Save,
  Check, Coins, Sparkles, Hash, FileText, Loader2, Menu, MoreVertical,
  UserCheck, UserPlus, Copy, Filter, Grid3x3, List, TrendingUp, Home, Scan, Database,
  Eye, Share2
} from 'lucide-react';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';
import toast from 'react-hot-toast';

// ─── Types ──────────────────────────────────────────────────────────────
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
  invitationCard: string | null;
  title?: string | null;
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

// ─── Countdown Timer ──────────────────────────────────────────────────
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
  const { data: session, status: sessionStatus } = useSession();
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
  const [activeTab, setActiveTab] = useState<'overview' | 'cards'>('overview');
  const [generatingCards, setGeneratingCards] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [searchTerm, setSearchTerm] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [allGuests, setAllGuests] = useState<Guest[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupSearch, setBackupSearch] = useState('');
  const [backupPage, setBackupPage] = useState(1);
  const [showThanksModal, setShowThanksModal] = useState(false);
  const [thanksMessage, setThanksMessage] = useState('');
  const [sendingThanks, setSendingThanks] = useState(false);
  const [showKumbushaModal, setShowKumbushaModal] = useState(false);
  const [kumbushaMessage, setKumbushaMessage] = useState('');
  const [sendingKumbusha, setSendingKumbusha] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    venue: '',
    address: '',
    date: '',
  });
  const [editing, setEditing] = useState(false);
  const [showEditGuestModal, setShowEditGuestModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [editGuestForm, setEditGuestForm] = useState({ name: '', phone: '' });
  const [savingGuest, setSavingGuest] = useState(false);
  const hasReportedLive = useRef(false);
  const [generatedCards, setGeneratedCards] = useState<any[]>([]);
  const [cardView, setCardView] = useState<'grid' | 'list'>('grid');

  // ─── Auth Check ──────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    const role = (session.user as any)?.role;
    if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
      router.push('/login');
      return;
    }
  }, [session, sessionStatus, router]);

  // ─── Resume Event ────────────────────────────────────────────────────
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

  // ─── Fetch Data ──────────────────────────────────────────────────────
  const fetchData = useCallback(async (id: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/events/${id}`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          return;
        }
        let detail = `HTTP ${res.status}`;
        try { const b = await res.json(); detail = b?.error || b?.message || detail; } catch { }
        throw new Error(detail);
      }
      const data = await res.json();
      if (!data?.event) throw new Error('Unexpected response format from server.');
      setEvent(data.event);
      setGuests(Array.isArray(data.guests) ? data.guests : []);
      setCurrentPage(1);
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
  }, [router]);

  const fetchCredits = async () => {
    try {
      const res = await fetch('/api/tenant/billing', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setCredits(data.tenant?.credits ?? 0);
    } catch { }
  };

  // ─── Effects ──────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    params.then(({ id }) => {
      if (cancelled) return;
      setEventId(id);
      fetchData(id);
      fetchCredits();
    }).catch((err) => {
      console.error('Failed to resolve params:', err);
      setFetchError('Could not read event ID from URL.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [params, fetchData]);

  // ─── Guest Selection ──────────────────────────────────────────────────
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

  // ─── Edit Guest ──────────────────────────────────────────────────────
  const openEditGuestModal = (guest: Guest) => {
    setEditingGuest(guest);
    setEditGuestForm({ name: guest.name, phone: guest.phone });
    setShowEditGuestModal(true);
  };

  const handleEditGuestChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditGuestForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSaveGuest = async () => {
    if (!editingGuest) return;
    if (!editGuestForm.name.trim() || !editGuestForm.phone.trim()) {
      toast.error('Name and phone are required');
      return;
    }

    setSavingGuest(true);
    try {
      const res = await fetch(`/api/guests/${editingGuest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editGuestForm.name.trim(),
          phone: editGuestForm.phone.trim(),
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok) {
        toast.success('Guest updated successfully!');
        setGuests(prev => prev.map(g =>
          g.id === editingGuest.id
            ? { ...g, name: editGuestForm.name.trim(), phone: editGuestForm.phone.trim() }
            : g
        ));
        setShowEditGuestModal(false);
        setEditingGuest(null);
        fetchData(eventId!);
      } else {
        toast.error(data.error || 'Failed to update guest');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSavingGuest(false);
    }
  };

  // ─── Scroll to Top ──────────────────────────────────────────────────
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => setShowBackToTop((e.target as HTMLDivElement).scrollTop > 300);
  const scrollToTop = () => document.getElementById('guest-list-container')?.scrollTo({ top: 0, behavior: 'smooth' });

  // ─── Filtered & Paginated Guests ──────────────────────────────────
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

  // ─── Backup Guests ──────────────────────────────────────────────────
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

  // ─── Kumbusha / Thanks ──────────────────────────────────────────────
  const whatsappCheckedInGuests = guests.filter(g => g.checkedIn && g.routingChannel === 'whatsapp');
  const checkedInCount = whatsappCheckedInGuests.length;

  const openThanksModal = () => {
    if (checkedInCount === 0) { toast.error('No WhatsApp-checked-in guests to thank.'); return; }
    setThanksMessage(`Thank you for attending ${event?.name}! We hope you enjoyed the event.`);
    setShowThanksModal(true);
  };

  const sendThanks = async () => {
    if (!thanksMessage.trim()) { toast.error('Please enter a thank-you message.'); return; }
    const totalCost = checkedInCount * 300;
    if (credits !== null && credits < totalCost) { toast.error(`Insufficient credits. Need ${totalCost} TZS, you have ${credits} TZS.`); return; }
    if (!confirm(`Send thank-you to ${checkedInCount} WhatsApp guest${checkedInCount > 1 ? 's' : ''}? This will cost ${totalCost} TZS.`)) return;
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
    if (errors.length === 0) toast.success(`Thank-you sent to ${successCount} of ${checkedInCount} guests.`);
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

  // ─── Edit Event ──────────────────────────────────────────────────────
  const openEditModal = () => {
    if (!event) return;

    const eventDate = new Date(event.date);
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

  // ─── Status Change Handler ──────────────────────────────────────────
  const handleStatusChange = useCallback((newStatus: string) => {
    if (newStatus === 'LIVE' && !hasReportedLive.current) {
      hasReportedLive.current = true;
      fetchData(eventId!);
    }
  }, [fetchData, eventId]);

  // ─── Memoized Values ────────────────────────────────────────────────
  const eventDate = useMemo(() => event ? new Date(event.date) : null, [event?.date]);

  const whatsappCount = guests.filter(g => g.routingChannel === 'whatsapp').length;
  const smsCount = guests.filter(g => g.routingChannel === 'sms').length;
  const checkedInAll = guests.filter(g => g.checkedIn).length;

  const isExpired = event?.status === 'EXPIRED';
  const isArchived = event?.status === 'ARCHIVED';
  const isLive = event?.status === 'LIVE';
  const isActive = event?.status === 'ACTIVE' || event?.status === 'LIVE';
  const isDraft = event?.status === 'DRAFT';

  const canResume = isExpired && event?.pausedAt && differenceInHours(new Date(), new Date(event.pausedAt)) < 168;
  const daysRemainingToResume = isExpired && event?.pausedAt
    ? Math.max(0, 7 - differenceInHours(new Date(), new Date(event.pausedAt)) / 24)
    : 0;

  const isEventDisabled = isExpired || isArchived;

  const getStatusBadge = () => {
    if (isArchived) {
      return { icon: <AlarmClockOff size={16} />, label: 'Archived', className: 'bg-gray-100 text-gray-600 border-gray-200' };
    }
    if (isExpired) {
      if (canResume) {
        return { icon: <Timer size={16} />, label: `Paused (${daysRemainingToResume.toFixed(0)} days left)`, className: 'bg-amber-50 text-amber-700 border-amber-200' };
      }
      return { icon: <AlarmClockOff size={16} />, label: 'Expired', className: 'bg-red-50 text-red-700 border-red-200' };
    }
    if (isLive) {
      return { icon: <AlarmClock size={16} className="animate-pulse" />, label: 'Live Now!', className: 'bg-green-50 text-green-700 border-green-200' };
    }
    if (isActive) {
      const hoursUntil = differenceInHours(new Date(event!.date), new Date());
      if (hoursUntil <= 24 && hoursUntil > 0) {
        return { icon: <Timer size={16} className="animate-pulse" />, label: 'Coming in 24 hours', className: 'bg-amber-50 text-amber-700 border-amber-200' };
      }
      return { icon: <CalendarClock size={16} />, label: `Active (${formatDistanceToNow(new Date(event!.date), { addSuffix: true })})`, className: 'bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border-[rgba(13,79,79,0.15)]' };
    }
    if (isDraft) {
      return { icon: <AlertCircle size={16} />, label: 'Draft', className: 'bg-gray-100 text-gray-500 border-gray-200' };
    }
    return { icon: <AlertCircle size={16} />, label: event?.status || 'Unknown', className: 'bg-gray-100 text-gray-500 border-gray-200' };
  };

  const statusBadge = getStatusBadge();

  // ─── Generate Cards Handler ────────────────────────────────────────────
  const handleGenerateCards = async () => {
    if (!event) return;

    const pendingGuests = guests.filter(g => !g.invitationCard);

    if (pendingGuests.length === 0) {
      toast.success('All guests already have cards');
      return;
    }

    if (pendingGuests.length > 50) {
      toast(`Generating ${pendingGuests.length} cards. This may take a few minutes.`, { duration: 5000 });
    }

    setGeneratingCards(true);
    let completed = 0;
    let failed = 0;

    try {
      const BATCH_SIZE = 10;
      const batches = [];

      for (let i = 0; i < pendingGuests.length; i += BATCH_SIZE) {
        batches.push(pendingGuests.slice(i, i + BATCH_SIZE));
      }

      let currentToast = toast.loading(`Generating cards (0/${pendingGuests.length})...`);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];

        try {
          const res = await fetch('/api/invitations/generate-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventId: event.id,
              guestIds: batch.map(g => g.id)
            }),
            credentials: 'include',
          });

          const data = await res.json();

          if (res.ok && data.results) {
            completed += data.completed || 0;
            failed += data.failed || 0;

            const progress = Math.min(completed + failed, pendingGuests.length);
            toast.loading(`Generating cards (${progress}/${pendingGuests.length})...`, {
              id: currentToast
            });
          } else {
            console.error('Batch error response:', data);
            toast.error(`Batch ${i + 1} failed: ${data.error || 'Unknown error'}`, { id: currentToast });
            failed += batch.length;
          }
        } catch (err) {
          console.error(`Batch ${i + 1} error:`, err);
          failed += batch.length;
        }

        if (i < batches.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      if (completed === pendingGuests.length) {
        toast.success(`All ${completed} cards generated successfully!`, { id: currentToast, duration: 3000 });
        
        // ─── Show Send Invitations Toast ───
        toast.custom((t) => (
          <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex flex-col overflow-hidden border border-gray-200`}>
            <div className="p-4 bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D]">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Send size={18} />
                Cards Generated Successfully!
              </h3>
            </div>
            <div className="p-4">
              <p className="text-gray-600 text-sm mb-4">
                {completed} invitation cards have been generated. Would you like to send them now?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    router.push(`/client/invitations/send/${event.id}`);
                  }}
                  className="flex-1 bg-[#0D4F4F] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0A3D3D] transition flex items-center justify-center gap-2"
                >
                  <Send size={16} />
                  Send Invitations
                </button>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-gray-200 transition"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        ), { duration: 8000 });
        
        // Refresh data to get updated card URLs
        fetchData(eventId!);
      } else if (completed > 0) {
        toast(`Generated ${completed} cards, ${failed} failed. Please try again.`, { id: currentToast, duration: 5000 });
      } else {
        toast.error('Failed to generate any cards. Please try again.', { id: currentToast, duration: 5000 });
      }

      fetchData(eventId!);
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('Network error while generating cards');
    } finally {
      setGeneratingCards(false);
    }
  };

  // ─── Render Guest Card ────────────────────────────────────────────────
  const renderGuestCard = (guest: Guest) => {
    const isSelected = selectedGuests.has(guest.id);
    const isWhatsApp = guest.routingChannel === 'whatsapp';
    const isCheckedIn = guest.checkedIn;
    const hasThanks = guest.thanksSentAt;
    const reminderCount = guest.reminderCount;
    const hasCard = guest.invitationCard;

    return (
      <div
        key={guest.id}
        className={`bg-white rounded-xl border transition-all hover:shadow-md ${isSelected ? 'border-[#0D4F4F] shadow-md' : 'border-gray-100'}`}
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
              <p className="font-semibold text-gray-800 text-sm truncate">
                {guest.title ? `${guest.title} ${guest.name}` : guest.name}
              </p>
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
              {hasCard ? (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  <ImageIcon size={12} /> Card
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  <Clock size={12} /> No Card
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
            {guest.invitationCard && (
              <a
                href={guest.invitationCard}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-blue-500 hover:text-blue-700 transition rounded"
                title="View Card"
              >
                <ImageIcon size={15} />
              </a>
            )}
            {event?.tenant?.testMode && (
              <Link href={`/invite/preview/${guest.id}`} target="_blank" className="p-1.5 text-gray-400 hover:text-[#0D4F4F] transition rounded">
                <ExternalLink size={15} />
              </Link>
            )}
            <button
              onClick={() => deleteGuest(guest.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 transition rounded"
              title="Delete guest"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={() => openEditGuestModal(guest)}
              className="p-1.5 text-gray-400 hover:text-[#0D4F4F] transition rounded"
              title="Edit guest"
            >
              <Edit2 size={15} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ─── Render Card Grid ────────────────────────────────────────────────
  const renderCardItem = (guest: Guest) => {
    if (!guest.invitationCard) return null;

    return (
      <div key={guest.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition group">
        <div className="relative aspect-[3/4] bg-gray-50">
          <img 
            src={guest.invitationCard} 
            alt={`${guest.name}'s invitation`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-2">
              <a
                href={guest.invitationCard}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition"
                title="View Card"
              >
                <Eye size={18} className="text-gray-700" />
              </a>
              <button
                onClick={() => {
                  // Share functionality
                  if (navigator.share) {
                    navigator.share({
                      title: `${guest.name}'s Invitation`,
                      url: guest.invitationCard || '',
                    }).catch(() => {});
                  } else {
                    navigator.clipboard.writeText(guest.invitationCard || '');
                    toast.success('Card link copied to clipboard!');
                  }
                }}
                className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition"
                title="Share Card"
              >
                <Share2 size={18} className="text-gray-700" />
              </button>
              <a
                href={guest.invitationCard}
                download={`${guest.name}-invitation.png`}
                className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition"
                title="Download Card"
              >
                <Download size={18} className="text-gray-700" />
              </a>
            </div>
          </div>
          <div className="absolute top-2 right-2">
            <span className="text-xs font-medium bg-[#0D4F4F] text-white px-2 py-0.5 rounded-full">
              #{guest.id.slice(0, 6)}
            </span>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-gray-800">{guest.title ? `${guest.title} ${guest.name}` : guest.name}</p>
              <p className="text-xs text-gray-400">{guest.phone}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => deleteGuest(guest.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 transition rounded"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${guest.routingChannel === 'whatsapp' ? 'bg-[rgba(13,79,79,0.08)] text-[#0D4F4F]' : 'bg-gray-100 text-gray-600'}`}>
              {guest.routingChannel === 'whatsapp' ? <MessageCircle size={10} /> : <Phone size={10} />}
              {guest.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
            </span>
            {guest.checkedIn && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                <CheckCircle size={10} /> Checked In
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Loading State ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <Loader2 size={32} className="animate-spin text-[#0D4F4F]" />
        <p className="text-sm text-gray-400">Loading event...</p>
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

  const guestsWithCards = guests.filter(g => g.invitationCard);
  const guestsWithoutCards = guests.filter(g => !g.invitationCard);

  // ─── Main JSX ──────────────────────────────────────────────────────────
  return (
    <>
      {/* ─── Modern Modal Styles ─── */}
      <style>{`
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center; z-index: 50; padding: 16px;
          animation: fadeIn 0.2s ease both;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-content {
          background: white; border-radius: 24px; width: 100%; max-width: 460px; max-height: 90vh;
          overflow-y: auto; box-shadow: 0 24px 64px rgba(0,0,0,0.2);
          animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .modal-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 20px 24px 16px; border-bottom: 1px solid #f0f0f0;
        }
        .modal-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 900; color: #0D1B1B; }
        .modal-title span { color: #E8A598; }
        .modal-body { padding: 20px 24px 24px; }
        .modal-close {
          width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid #E2EAF0;
          background: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: #9BAAB8; transition: border-color 0.15s, color 0.15s;
        }
        .modal-close:hover { border-color: #C0392B; color: #C0392B; }
        .field-label { display: block; font-size: 13px; font-weight: 600; color: #4A6072; margin-bottom: 5px; }
        .field-input {
          width: 100%; padding: 12px 14px; border: 1.5px solid #E2EAF0; border-radius: 11px;
          font-size: 14px; outline: none; color: #0D1B1B; background: white; font-weight: 500;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .field-input:focus { border-color: #0D4F4F; box-shadow: 0 0 0 4px rgba(13,79,79,0.08); }
        .btn-primary {
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D); color: white;
          padding: 13px 20px; border-radius: 13px; font-weight: 700; font-size: 14px;
          border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 14px rgba(13,79,79,0.32); transition: transform 0.15s, box-shadow 0.15s;
        }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(13,79,79,0.4); }
        .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-secondary {
          padding: 13px 20px; border-radius: 13px; font-weight: 700; font-size: 14px;
          border: 1.5px solid #E2EAF0; background: white; color: #4A6072;
          cursor: pointer; transition: border-color 0.15s, color 0.15s;
        }
        .btn-secondary:hover { border-color: #0D4F4F; color: #0D4F4F; }
        .tab-button {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          flex: 1; padding: 10px 0; border-radius: 10px; font-weight: 600; font-size: 13px;
          transition: all 0.2s; cursor: pointer; border: none; background: transparent; color: #9BAAB8;
        }
        .tab-button.active {
          background: #0D4F4F; color: white; box-shadow: 0 4px 12px rgba(13,79,79,0.25);
        }
        .tab-button:hover:not(.active) { color: #0D4F4F; background: rgba(13,79,79,0.05); }
      `}</style>

      <div className="min-h-screen bg-gray-50 pb-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">

          {/* ─── Top Navigation ─── */}
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/client/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-white border border-[rgba(13,79,79,0.12)] rounded-xl px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.06)]"
            >
              <ArrowLeft size={14} /> Back
            </Link>
            <div className="flex items-center gap-2">
              {!isArchived && (
                <button
                  onClick={openEditModal}
                  className="p-2 text-[#0D4F4F] bg-white border border-[rgba(13,79,79,0.12)] rounded-xl hover:bg-[rgba(13,79,79,0.06)] transition"
                  title="Edit Event"
                >
                  <Pencil size={16} />
                </button>
              )}
              {isEventDisabled && canResume && (
                <button
                  onClick={handleResumeEvent}
                  className="p-2 text-green-700 bg-white border border-green-200 rounded-xl hover:bg-green-50 transition"
                  title="Resume Event"
                >
                  <RotateCw size={16} />
                </button>
              )}
              <button
                onClick={async () => {
                  if (!confirm('Delete this event and ALL its guests? This action cannot be undone.')) return;
                  const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE', credentials: 'include' });
                  if (res.ok) { toast.success('Event deleted'); router.push('/client/events'); }
                  else { const data = await res.json(); toast.error(data.error || 'Failed to delete event'); }
                }}
                className="p-2 text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition"
                title="Delete Event"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* ─── Event Header ─── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-serif text-2xl font-black text-gray-900 truncate">{event.name}</h1>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusBadge.className}`}>
                    {statusBadge.icon}
                    {statusBadge.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} className="text-[#0D4F4F]" />
                    {format(new Date(event.date), 'PPP')}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={14} className="text-[#0D4F4F]" />
                    {event.venue}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{event.address}</p>
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
            </div>

            {isExpired && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
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

          {/* ─── Stats Overview ─── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
              <p className="text-lg font-bold text-gray-900">{guests.length}</p>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Total</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
              <p className="text-lg font-bold text-green-600">{checkedInAll}</p>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Checked In</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
              <p className="text-lg font-bold text-[#0D4F4F]">{guestsWithCards.length}</p>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Cards</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-3 text-center shadow-sm">
              <p className="text-lg font-bold text-amber-600">{guestsWithoutCards.length}</p>
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">No Card</p>
            </div>
          </div>

          {/* ─── Tab Navigation (Styled like your design) ─── */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-2 mb-4">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
              >
                <Home size={16} /> Overview
              </button>
              <button
                onClick={() => setActiveTab('cards')}
                className={`tab-button ${activeTab === 'cards' ? 'active' : ''}`}
              >
                <ImageIcon size={16} /> Cards
                {guestsWithCards.length > 0 && (
                  <span className="text-xs bg-white/20 text-white px-1.5 py-0.5 rounded-full">
                    {guestsWithCards.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* ─── Overview Tab ─── */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {isEventDisabled ? (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                  <AlertCircle size={24} className="text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500 font-medium">
                    This event is {event.status === 'ARCHIVED' ? 'archived' : 'paused'}. Actions are disabled.
                    {canResume && ' You can resume it using the Resume button above.'}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      href={`/client/invitations/send/${event.id}`}
                      className="col-span-2 bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white text-center py-3.5 rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                    >
                      <Send size={16} /> Send Invitations
                    </Link>

                    <button
                      onClick={openKumbushaModal}
                      className="bg-amber-50 border border-amber-200 text-amber-700 py-3 rounded-xl font-bold hover:bg-amber-100 transition flex items-center justify-center gap-2"
                    >
                      <Bell size={16} /> Remind ({kumbushaCount})
                    </button>

                    <button
                      onClick={handleGenerateCards}
                      disabled={generatingCards || guests.length === 0}
                      className="bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {generatingCards ? <Loader2 size={16} className="animate-spin" /> : <Palette size={16} />}
                      {generatingCards ? 'Generating...' : `Cards (${guestsWithoutCards.length})`}
                    </button>

                    <Link
                      href={`/client/guests/import/${event.id}`}
                      className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] py-3 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2"
                    >
                      <Upload size={16} /> Import
                    </Link>

                    <Link
                      href={`/client/guests/add/${event.id}`}
                      className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] py-3 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Add Guest
                    </Link>

                    <Link
                      href={`/client/invitations/design/${event.id}`}
                      className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] py-3 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2"
                    >
                      <Palette size={16} /> Design
                    </Link>

                    <Link
                      href={`/client/check-in?event=${event.id}`}
                      className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] py-3 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2"
                    >
                      <QrCode size={16} /> Check-In
                    </Link>
                  </div>

                  {checkedInCount > 0 && (
                    <button
                      onClick={openThanksModal}
                      className="w-full bg-gradient-to-r from-[#E8A598] to-[#D4857A] text-white py-3.5 rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2"
                    >
                      <Heart size={16} /> Send Thanks ({checkedInCount})
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* ─── Cards Tab ─── */}
          {activeTab === 'cards' && (
            <div className="space-y-4">
              {/* Cards Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateCards}
                    disabled={generatingCards || guests.length === 0}
                    className="bg-[#0D4F4F] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0A3D3D] transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {generatingCards ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {generatingCards ? 'Generating...' : `Generate Cards (${guestsWithoutCards.length})`}
                  </button>
                  <span className="text-xs text-gray-400">
                    {guestsWithCards.length} cards generated
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCardView('grid')}
                    className={`p-2 rounded-lg transition ${cardView === 'grid' ? 'bg-[#0D4F4F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    title="Grid View"
                  >
                    <Grid3x3 size={16} />
                  </button>
                  <button
                    onClick={() => setCardView('list')}
                    className={`p-2 rounded-lg transition ${cardView === 'list' ? 'bg-[#0D4F4F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    title="List View"
                  >
                    <List size={16} />
                  </button>
                </div>
              </div>

              {/* Cards Display */}
              {guestsWithCards.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
                  <ImageIcon size={48} className="text-gray-300 mx-auto mb-3" />
                  <h3 className="font-serif text-lg font-bold text-gray-800 mb-1">No Cards Generated</h3>
                  <p className="text-sm text-gray-400 mb-4">Generate invitation cards for your guests</p>
                  <button
                    onClick={handleGenerateCards}
                    disabled={generatingCards || guests.length === 0}
                    className="bg-[#0D4F4F] text-white px-6 py-2.5 rounded-xl font-bold hover:bg-[#0A3D3D] transition disabled:opacity-50 inline-flex items-center gap-2"
                  >
                    {generatingCards ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                    {generatingCards ? 'Generating...' : 'Generate Cards'}
                  </button>
                </div>
              ) : cardView === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {guestsWithCards.map(renderCardItem)}
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="divide-y divide-gray-100">
                    {guestsWithCards.map((guest) => (
                      <div key={guest.id} className="flex items-center gap-4 p-3 hover:bg-gray-50 transition">
                        <img 
                          src={guest.invitationCard!} 
                          alt={guest.name}
                          className="w-16 h-16 rounded-lg object-cover border border-gray-100 flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-800">{guest.title ? `${guest.title} ${guest.name}` : guest.name}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-400">
                            <span>{guest.phone}</span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              {guest.routingChannel === 'whatsapp' ? <MessageCircle size={10} /> : <Phone size={10} />}
                              {guest.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <a
                            href={guest.invitationCard!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                            title="View Card"
                          >
                            <Eye size={16} />
                          </a>
                          <button
                            onClick={() => {
                              if (navigator.share) {
                                navigator.share({
                                  title: `${guest.name}'s Invitation`,
                                  url: guest.invitationCard || '',
                                }).catch(() => {});
                              } else {
                                navigator.clipboard.writeText(guest.invitationCard || '');
                                toast.success('Card link copied!');
                              }
                            }}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                            title="Share Card"
                          >
                            <Share2 size={16} />
                          </button>
                          <a
                            href={guest.invitationCard!}
                            download={`${guest.name}-invitation.png`}
                            className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                            title="Download Card"
                          >
                            <Download size={16} />
                          </a>
                          <button
                            onClick={() => deleteGuest(guest.id)}
                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Kumbusha Modal ─── */}
      {showKumbushaModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowKumbushaModal(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title">Kumbusha <span>Michango</span></div>
              <button className="modal-close" onClick={() => setShowKumbushaModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[rgba(13,79,79,0.1)] flex items-center justify-center text-[#0D4F4F]"><Users size={18} /></div>
                <div>
                  <p className="text-xs text-gray-400">Wageni waliopo</p>
                  <p className="font-bold text-gray-800">{kumbushaCount} SMS guests pending</p>
                </div>
              </div>

              <div className={`rounded-xl p-4 mb-4 flex items-center gap-3 ${isFree ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl">
                  {isFree ? <Check size={20} className="text-green-600" /> : <Coins size={20} className="text-amber-600" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">{isFree ? 'Kumbusho 2 za kwanza bure' : `Gharama: ${kumbushaTotalCost} TZS`}</p>
                  {credits !== null && <p className="text-xs text-gray-400">Salio: {credits} TZS</p>}
                </div>
              </div>

              <label className="field-label">Ujumbe wa kukumbusha</label>
              <textarea
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent resize-none text-sm"
                rows={3}
                value={kumbushaMessage}
                onChange={e => setKumbushaMessage(e.target.value)}
                placeholder="Andika ujumbe hapa..."
              />
              <div className="text-right text-xs text-gray-400 mt-1">{kumbushaMessage.length} herufi</div>

              <div className="flex gap-3 mt-4">
                <button className="flex-1 btn-secondary" onClick={() => setShowKumbushaModal(false)}>Ghairi</button>
                <button
                  className="flex-1 btn-primary"
                  onClick={sendKumbusha}
                  disabled={sendingKumbusha || !kumbushaMessage.trim() || (kumbushaTotalCost > 0 && credits !== null && credits < kumbushaTotalCost)}
                >
                  {sendingKumbusha ? <Loader2 size={18} className="animate-spin" /> : <Bell size={18} />}
                  {sendingKumbusha ? 'Inatuma...' : 'Tuma Ukumbusho'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Thanks Modal ─── */}
      {showThanksModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowThanksModal(false); }}>
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title">Tuma <span>Shukrani</span></div>
              <button className="modal-close" onClick={() => setShowThanksModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="bg-gray-50 rounded-xl p-4 mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[rgba(13,79,79,0.1)] flex items-center justify-center text-[#0D4F4F]"><Heart size={18} /></div>
                <div>
                  <p className="text-xs text-gray-400">Wageni wa kupokea</p>
                  <p className="font-bold text-gray-800">{checkedInCount} WhatsApp guests</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-amber-600"><Coins size={20} /></div>
                <div>
                  <p className="text-sm font-semibold">Gharama: {checkedInCount * 300} TZS</p>
                  {credits !== null && <p className="text-xs text-gray-400">Mikopo iliyobaki: {credits} TZS</p>}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-3 mb-4 text-center border border-gray-200">
                {event.thankYouCardUrl ? (
                  <img src={event.thankYouCardUrl} alt="Thanks Card" className="max-h-32 mx-auto rounded-lg object-contain" />
                ) : (
                  <p className="text-sm text-gray-400">Hakuna kadi ya shukrani</p>
                )}
              </div>

              <label className="field-label">Ujumbe wa shukrani</label>
              <textarea
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent resize-none text-sm"
                rows={3}
                value={thanksMessage}
                onChange={e => setThanksMessage(e.target.value)}
                placeholder="Andika ujumbe wa shukrani..."
              />
              <div className="text-right text-xs text-gray-400 mt-1">{thanksMessage.length} herufi</div>

              <div className="flex gap-3 mt-4">
                <button className="flex-1 btn-secondary" onClick={() => setShowThanksModal(false)}>Ghairi</button>
                <button
                  className="flex-1 btn-primary"
                  onClick={sendThanks}
                  disabled={sendingThanks || !thanksMessage.trim() || (credits !== null && credits < checkedInCount * 300) || !event.thankYouCardUrl}
                >
                  {sendingThanks ? <Loader2 size={18} className="animate-spin" /> : <Heart size={18} />}
                  {sendingThanks ? 'Inatuma...' : 'Tuma Shukrani'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Edit Event Modal ─── */}
      {showEditModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div className="modal-title">Update <span>Event</span></div>
              <button className="modal-close" onClick={() => setShowEditModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-body">
              <div className="space-y-4">
                <div>
                  <label className="field-label">Event Name</label>
                  <input type="text" name="name" value={editForm.name} onChange={handleEditChange} className="field-input" required />
                </div>
                <div>
                  <label className="field-label">Venue</label>
                  <input type="text" name="venue" value={editForm.venue} onChange={handleEditChange} className="field-input" required />
                </div>
                <div>
                  <label className="field-label">Address</label>
                  <input type="text" name="address" value={editForm.address} onChange={handleEditChange} className="field-input" />
                </div>
                <div>
                  <label className="field-label">Date & Time</label>
                  <input type="datetime-local" name="date" value={editForm.date} onChange={handleEditChange} className="field-input" required />
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" className="flex-1 btn-secondary" onClick={() => setShowEditModal(false)}>Cancel</button>
                <button type="submit" className="flex-1 btn-primary" disabled={editing}>
                  {editing ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {editing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Guest Modal ─── */}
      {showEditGuestModal && editingGuest && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowEditGuestModal(false); }}>
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div className="modal-title">Update <span>Guest</span></div>
              <button className="modal-close" onClick={() => setShowEditGuestModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              <div className="space-y-4">
                <div>
                  <label className="field-label">Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={editGuestForm.name}
                    onChange={handleEditGuestChange}
                    className="field-input"
                    placeholder="Enter guest name"
                    required
                  />
                </div>
                <div>
                  <label className="field-label">Phone Number</label>
                  <input
                    type="text"
                    name="phone"
                    value={editGuestForm.phone}
                    onChange={handleEditGuestChange}
                    className="field-input"
                    placeholder="+255712345678"
                    required
                  />
                  <p className="text-xs text-gray-400 mt-1">Include country code (e.g., +255...)</p>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" className="flex-1 btn-secondary" onClick={() => setShowEditGuestModal(false)}>Cancel</button>
                <button
                  type="button"
                  className="flex-1 btn-primary"
                  onClick={handleSaveGuest}
                  disabled={savingGuest || !editGuestForm.name.trim() || !editGuestForm.phone.trim()}
                >
                  {savingGuest ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {savingGuest ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Backup Modal ─── */}
      {showBackupModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowBackupModal(false); }}>
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div className="modal-title">All <span>Guests</span></div>
              <button className="modal-close" onClick={() => setShowBackupModal(false)}><X size={16} /></button>
            </div>
            <div className="modal-body">
              {backupLoading ? (
                <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-[#0D4F4F]" /></div>
              ) : (
                <>
                  <div className="relative mb-4">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={backupSearch}
                      onChange={(e) => { setBackupSearch(e.target.value); setBackupPage(1); }}
                      placeholder="Search all guests..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                    />
                  </div>

                  {backupPaginated.length === 0 ? (
                    <div className="text-center py-8 text-gray-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No guests found</p></div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                      {backupPaginated.map(g => (
                        <div key={g.id} className="py-2.5 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#0D4F4F]/10 flex items-center justify-center text-[#0D4F4F] font-bold text-sm flex-shrink-0">
                            {g.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-800 truncate">{g.title ? `${g.title} ${g.name}` : g.name}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span className="truncate">{g.phone || 'No phone'}</span>
                              <span>•</span>
                              <span className={`inline-flex items-center gap-1 ${g.checkedIn ? 'text-green-600' : 'text-amber-600'}`}>
                                {g.checkedIn ? <CheckCircle size={12} /> : <Clock size={12} />}
                                {g.checkedIn ? 'Checked in' : 'Pending'}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full truncate max-w-20">
                            {g.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {backupTotalPages > 1 && (
                    <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-100">
                      <span className="text-xs text-gray-400">{filteredBackup.length} guests</span>
                      <div className="flex gap-1">
                        <button onClick={() => setBackupPage(p => Math.max(1, p - 1))} disabled={backupPage === 1} className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">Previous</button>
                        <span className="px-3 py-1 text-sm font-semibold text-gray-700">{backupPage} / {backupTotalPages}</span>
                        <button onClick={() => setBackupPage(p => Math.min(backupTotalPages, p + 1))} disabled={backupPage === backupTotalPages} className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">Next</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}