'use client';

import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Calendar, MapPin, Users, QrCode, MessageCircle, Phone, ArrowLeft, ArrowRight,
  Upload, Plus, Palette, Send, CheckCircle, Trash2, CheckSquare,
  Square, ArrowUp, Heart, X, Image as ImageIcon, Bell,
  Search, Download, Clock, AlertCircle, Timer, CalendarClock,
  AlarmClock, AlarmClockOff, RotateCw, Pencil, Edit2, Save,
  Check, Coins, CreditCard, Hash, Loader2, MoreVertical, Compass,
  PenTool, Wand, Grid3x3, List, Eye, Share2, Printer, Link2, AlertTriangle, Lock,
  ChevronDown, PartyPopper,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, formatDistanceToNow, differenceInHours } from 'date-fns';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';
import ThanksCardModal from '@/components/ThanksCardModal';
import GuestPageThemeEditor from '@/app/components/GuestPageThemeEditor';

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
  cardNumber?: string | null;
  guestType?: string | null;
  cardGroupId?: string | null;
  passCode?: string | null;
  event?: EventData;
}

interface EventData {
  id: string;
  name: string;
  date: string;
  venue: string;
  address: string;
  commission_paid: boolean;
  thankYouCardUrl: string | null;
  tenant: { testMode: boolean; bypassPayment?: boolean };
  status: string;
  pausedAt: string | null;
  expiresAt: string | null;
  resumedAt: string | null;
  reminderSent: boolean;
  expiredNotified: boolean;
  resumedBy: string | null;
}

interface RsvpRow {
  id: string;
  guestId: string | null;
  guestName: string;
  status: string;
  createdAt: string;
}

interface WishRow {
  id: string;
  guestId: string | null;
  guestName: string;
  message: string;
  attending: string | null;
  createdAt: string;
}

type FlowStep = 'guests' | 'design' | 'generate' | 'send';

const STEPS: { id: FlowStep; label: string; short: string; icon: React.ReactNode }[] = [
  { id: 'guests', label: 'Guests', short: '1', icon: <Users size={16} /> },
  { id: 'design', label: 'Design', short: '2', icon: <Palette size={16} /> },
  { id: 'generate', label: 'Cards', short: '3', icon: <CreditCard size={16} /> },
  { id: 'send', label: 'Send', short: '4', icon: <Send size={16} /> },
];

// ─── Countdown Timer ──────────────────────────────────────────────────
const EventCountdown = React.memo(({ targetDate }: { targetDate: string }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [status, setStatus] = useState<'ACTIVE' | 'REMINDER' | 'LIVE'>('ACTIVE');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const target = useMemo(() => new Date(targetDate), [targetDate]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    const compute = () => {
      const now = new Date();
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setStatus('LIVE');
        if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds });
      if (days === 0 && hours <= 24 && hours > 0) setStatus('REMINDER');
      else setStatus('ACTIVE');
    };

    compute();
    intervalRef.current = setInterval(compute, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [target]);

  const formattedTime = `${String(timeLeft.days).padStart(2, '0')}d ${String(timeLeft.hours).padStart(2, '0')}h ${String(timeLeft.minutes).padStart(2, '0')}m ${String(timeLeft.seconds).padStart(2, '0')}s`;

  if (status === 'LIVE') {
    return (
      <div className="flex items-center gap-1.5 text-success bg-success-soft px-2.5 py-1 rounded-full border border-success-border">
        <AlarmClock size={13} className="animate-pulse" />
        <span className="font-bold text-xs">Happening now</span>
      </div>
    );
  }

  if (status === 'REMINDER') {
    return (
      <div className="flex items-center gap-1.5 text-warn bg-warn-soft px-2.5 py-1 rounded-full border border-warn-border">
        <Timer size={13} />
        <span className="font-bold text-xs">{formattedTime}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-brand bg-brand/10 px-2.5 py-1 rounded-full border border-brand/20">
      <CalendarClock size={13} />
      <span className="font-bold text-xs">{formattedTime}</span>
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
  const [rsvps, setRsvps] = useState<RsvpRow[]>([]);
  const [wishes, setWishes] = useState<WishRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [countdownKey, setCountdownKey] = useState(0);
  const [activeStep, setActiveStep] = useState<FlowStep>('guests');
  const [showJourneyIntro, setShowJourneyIntro] = useState(true);
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
  const [showKumbushaModal, setShowKumbushaModal] = useState(false);
  const [kumbushaMessage, setKumbushaMessage] = useState('');
  const [sendingKumbusha, setSendingKumbusha] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', venue: '', address: '', date: '' });
  const [editing, setEditing] = useState(false);
  const [showEditGuestModal, setShowEditGuestModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [editGuestForm, setEditGuestForm] = useState({ name: '', phone: '' });
  const [savingGuest, setSavingGuest] = useState(false);
  const [cardView, setCardView] = useState<'grid' | 'list'>('grid');
  const [selectedCardGuest, setSelectedCardGuest] = useState<Guest | null>(null);
  const [showCardModal, setShowCardModal] = useState(false);
  const [showManageMenu, setShowManageMenu] = useState(false);
  const [showGuestPageEditor, setShowGuestPageEditor] = useState(false);
  const manageMenuRef = useRef<HTMLDivElement | null>(null);
  const manageMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const [generationProgress, setGenerationProgress] = useState<{
    total: number;
    completed: number;
    failed: number;
  } | null>(null);

  // ─── Auth Check ──────────────────────────────────────────────────────
  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (!session) { router.push('/login'); return; }
    const role = session.user?.role;
    if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') { router.push('/login'); return; }
  }, [session, sessionStatus, router]);

  // ─── Close manage menu on outside click or Escape ──────────────────
  useEffect(() => {
    if (!showManageMenu) return;
    const onClick = (e: MouseEvent) => {
      if (manageMenuRef.current && !manageMenuRef.current.contains(e.target as Node)) {
        setShowManageMenu(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowManageMenu(false);
        manageMenuButtonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [showManageMenu]);

  // ─── Escape closes the topmost open dialog ───────────────────────────
  // One listener for the real dialogs, checked in z-order so Escape always
  // dismisses the sheet the user is actually looking at. showGuestPageEditor
  // is deliberately absent: that is an inline accordion, not a dialog.
  useEffect(() => {
    const anyOpen =
      showCardModal || showEditGuestModal ||
      showKumbushaModal || showThanksModal || showBackupModal || showEditModal;
    if (!anyOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showCardModal) setShowCardModal(false);
      else if (showEditGuestModal) setShowEditGuestModal(false);
      else if (showKumbushaModal) setShowKumbushaModal(false);
      else if (showThanksModal) setShowThanksModal(false);
      else if (showBackupModal) setShowBackupModal(false);
      else if (showEditModal) setShowEditModal(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [
    showCardModal, showEditGuestModal, showKumbushaModal,
    showThanksModal, showBackupModal, showEditModal,
  ]);

  // ─── Lock background scroll while any dialog is open ─────────────────
  // Compensating for the removed scrollbar width stops the page shifting
  // sideways when a dialog opens on desktop.
  const anyDialogOpen =
    showCardModal || showEditGuestModal ||
    showKumbushaModal || showThanksModal || showBackupModal || showEditModal;
  useEffect(() => {
    if (!anyDialogOpen) return;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    const prevPadding = body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (gap > 0) body.style.paddingRight = `${gap}px`;
    return () => {
      body.style.overflow = prevOverflow;
      body.style.paddingRight = prevPadding;
    };
  }, [anyDialogOpen]);

  // ─── Resume Event ────────────────────────────────────────────────────
  const handleResumeEvent = async () => {
    if (!eventId) return;
    const ok = await confirmToast({ title: 'Resume this event?', message: 'It will become active again for 7 days.', confirmText: 'Resume' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/events/${eventId}/resume`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) { toast.success('Event resumed successfully!'); fetchData(eventId); setCountdownKey(prev => prev + 1); }
      else toast.error(data.error || 'Failed to resume event');
    } catch { toast.error('Network error'); }
  };

  // ─── Fetch Data ──────────────────────────────────────────────────────
  const fetchData = useCallback(async (id: string) => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`/api/events/${id}`, { credentials: 'include' });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { router.push('/login'); return; }
        let detail = `HTTP ${res.status}`;
        try { const b = await res.json(); detail = b?.error || b?.message || detail; } catch { }
        throw new Error(detail);
      }
      const data = await res.json();
      if (!data?.event) throw new Error('Unexpected response format from server.');
      setEvent(data.event);
      setGuests(Array.isArray(data.guests) ? data.guests : []);
      setRsvps(Array.isArray(data.rsvps) ? data.rsvps : []);
      setWishes(Array.isArray(data.wishes) ? data.wishes : []);
      setCurrentPage(1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setFetchError(msg);
      toast.error(`Could not load event: ${msg}`);
    } finally { setLoading(false); }
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
    const ok = await confirmToast({
      title: `Delete ${selectedGuests.size} selected guest${selectedGuests.size > 1 ? 's' : ''}?`,
      message: 'This action cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
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
    const ok = await confirmToast({ title: 'Delete this guest?', message: 'This action cannot be undone.', confirmText: 'Delete', danger: true });
    if (!ok) return;
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
    if (!editGuestForm.name.trim() || !editGuestForm.phone.trim()) { toast.error('Name and phone are required'); return; }
    setSavingGuest(true);
    try {
      const res = await fetch(`/api/guests/${editingGuest.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editGuestForm.name.trim(), phone: editGuestForm.phone.trim() }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Guest updated successfully!');
        setGuests(prev => prev.map(g => g.id === editingGuest.id ? { ...g, name: editGuestForm.name.trim(), phone: editGuestForm.phone.trim() } : g));
        setShowEditGuestModal(false);
        setEditingGuest(null);
        fetchData(eventId!);
      } else toast.error(data.error || 'Failed to update guest');
    } catch { toast.error('Network error'); }
    finally { setSavingGuest(false); }
  };

  // ─── Scroll to Top ──────────────────────────────────────────────────
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => setShowBackToTop((e.target as HTMLDivElement).scrollTop > 300);
  const scrollToTop = () => document.getElementById('guest-list-container')?.scrollTo({ top: 0, behavior: 'smooth' });

  // ─── Filtered & Paginated Guests ──────────────────────────────────
  const filteredGuests = useMemo(() => {
    if (!searchTerm.trim()) return guests;
    const term = searchTerm.trim().toLowerCase();
    return guests.filter(g => g.name.toLowerCase().includes(term) || (g.phone && g.phone.includes(term)));
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
        if (res.ok) { const data = await res.json(); setAllGuests(data.guests || []); }
        else toast.error('Failed to load all guests');
      } catch { toast.error('Network error'); }
      finally { setBackupLoading(false); }
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

  // ─── Thanks Card ─────────────────────────────────────────────────────
  // The Thanks Card modal handles both WhatsApp (single uploaded card, no
  // variables) and SMS (individualized message) for checked-in guests only.
  const checkedInCount = guests.filter(g => g.checkedIn).length;

  const openThanksModal = () => {
    if (checkedInCount === 0) { toast.error('No checked-in guests to thank yet.'); return; }
    setShowThanksModal(true);
    setShowManageMenu(false);
  };

  const kumbushaGuests = guests.filter(g => !g.checkedIn && g.routingChannel === 'sms');
  const kumbushaCount = kumbushaGuests.length;
  const kumbushaTotalCost = kumbushaGuests.reduce((sum, g) => sum + (g.reminderCount < 2 ? 0 : 50), 0);
  const isFree = kumbushaTotalCost === 0;

  const openKumbushaModal = () => {
    if (kumbushaCount === 0) { toast.error('No SMS guests pending check-in.'); return; }
    setKumbushaMessage(`Karibu ${event?.name}! Tafadhali kumbuka kuleta mchango wako.`);
    setShowKumbushaModal(true);
    setShowManageMenu(false);
  };

  const sendKumbusha = async () => {
    if (!kumbushaMessage.trim()) { toast.error('Andika ujumbe wa kukumbusha.'); return; }
    if (kumbushaTotalCost > 0 && credits !== null && credits < kumbushaTotalCost) { toast.error(`Mikopo haitoshi. Unahitaji ${kumbushaTotalCost} TZS, una ${credits} TZS.`); return; }
    const costText = isFree ? 'bure' : `${kumbushaTotalCost} TZS`;
    const ok = await confirmToast({
      title: `Tuma ukumbusho kwa wageni ${kumbushaCount}?`,
      message: `Gharama: ${costText}.`,
      confirmText: 'Tuma',
    });
    if (!ok) return;
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
      } else toast.error('Imeshindwa kutuma ukumbusho.');
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
    setEditForm({ name: event.name, venue: event.venue, address: event.address || '', date: localDateStr });
    setShowEditModal(true);
    setShowManageMenu(false);
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Do not allow a date/time change once any guest has checked in.
    const originalDate = event?.date ? new Date(event.date).getTime() : null;
    const editedDate = editForm.date ? new Date(editForm.date).getTime() : null;
    if (checkedInAll > 0 && originalDate !== null && editedDate !== null && originalDate !== editedDate) {
      toast.error('The event date/time cannot be changed because guests have already checked in.');
      return;
    }
    setEditing(true);
    try {
      // Build timezone-aware ISO string so server stores correct UTC time
      const localDate = new Date(editForm.date);
      const offsetMinutes = localDate.getTimezoneOffset();
      const sign = offsetMinutes <= 0 ? '+' : '-';
      const absOffset = Math.abs(offsetMinutes);
      const offsetH = String(Math.floor(absOffset / 60)).padStart(2, '0');
      const offsetM = String(absOffset % 60).padStart(2, '0');
      const dateISO = `${editForm.date}:00${sign}${offsetH}:${offsetM}`;

      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editForm.name, venue: editForm.venue, address: editForm.address, date: dateISO }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) { toast.success('Event updated successfully!'); setShowEditModal(false); fetchData(eventId!); setCountdownKey(prev => prev + 1); }
      else toast.error(data.error || 'Failed to update event');
    } catch { toast.error('Network error'); }
    finally { setEditing(false); }
  };

  // ─── Memoized Values ────────────────────────────────────────────────
  const eventDate = useMemo(() => event ? new Date(event.date) : null, [event?.date]);

  const whatsappCount = guests.filter(g => g.routingChannel === 'whatsapp').length;
  const smsCount = guests.filter(g => g.routingChannel === 'sms').length;
  const checkedInAll = guests.filter(g => g.checkedIn).length;
  const sentCount = guests.filter(g => g.invitationSentAt).length;

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
    if (isArchived) return { icon: <AlarmClockOff size={13} />, label: 'Archived', className: 'bg-gray-100 text-gray-600 border-gray-200' };
    if (isExpired) {
      if (canResume) return { icon: <Timer size={13} />, label: `Paused (${daysRemainingToResume.toFixed(0)}d left)`, className: 'bg-warn-soft text-warn border-warn-border' };
      return { icon: <AlarmClockOff size={13} />, label: 'Expired', className: 'bg-danger-soft text-danger border-danger-border' };
    }
    if (isLive) return { icon: <AlarmClock size={13} className="animate-pulse" />, label: 'Live Now!', className: 'bg-success-soft text-success border-success-border' };
    if (isActive) {
      const hoursUntil = differenceInHours(new Date(event!.date), new Date());
      if (hoursUntil <= 24 && hoursUntil > 0) return { icon: <Timer size={13} className="animate-pulse" />, label: 'In 24 hours', className: 'bg-warn-soft text-warn border-warn-border' };
      return { icon: <CalendarClock size={13} />, label: formatDistanceToNow(new Date(event!.date), { addSuffix: true }), className: 'bg-brand/10 text-brand border-brand/20' };
    }
    if (isDraft) return { icon: <AlertCircle size={13} />, label: 'Draft', className: 'bg-gray-100 text-gray-500 border-gray-200' };
    return { icon: <AlertCircle size={13} />, label: event?.status || 'Unknown', className: 'bg-gray-100 text-gray-500 border-gray-200' };
  };

  const statusBadge = getStatusBadge();

  const guestsWithCards = guests.filter(g => g.invitationCard);
  const guestsWithoutCards = guests.filter(g => !g.invitationCard);

  // ─── Step completion ──────────────────────────────────────────────────
  const stepComplete: Record<FlowStep, boolean> = {
    guests: guests.length > 0,
    design: true, // Always accessible
    generate: guests.length > 0 && guestsWithoutCards.length === 0,
    send: guests.length > 0 && sentCount === guests.length,
  };

  const stepIndex = STEPS.findIndex(s => s.id === activeStep);
  const goToStep = (step: FlowStep) => {
    setActiveStep(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goNextStep = () => { if (stepIndex < STEPS.length - 1) goToStep(STEPS[stepIndex + 1].id); };

  // Friendly guidance shown under each step describing what comes next
  const nextUp = (() => {
    if (activeStep === 'guests') {
      return stepComplete.guests
        ? 'Great - your guest list is ready. Next, design a single invitation template that will be used for every guest.'
        : 'Start by adding your guests - you can import a spreadsheet or add them one by one. You need at least one guest to continue.';
    }
    if (activeStep === 'design') {
      return stepComplete.generate
        ? 'Card design looks complete. Next, review your generated cards and then send them to your guests.'
        : 'Now personalise one card design. When you save it, you\'ll move on to generating a card for each guest.';
    }
    if (activeStep === 'generate') {
      return stepComplete.generate
        ? 'All cards are generated. Next, send your invitations by WhatsApp or SMS.'
        : 'Generate a personalised card for each guest. Missing cards are shown below - click Generate when ready.';
    }
    return stepComplete.send
      ? 'All invitations sent! Your guests can now receive their personal cards. You\'re all set.'
      : 'Ready to share the love - send your invitations now. You can pick WhatsApp, SMS, or both.';
  })();

  // ─── Generate Cards Handler (Smart - Only for guests without cards) ──
  const handleGenerateCards = async () => {
    if (!event) return;

    const pendingGuests = guests.filter(g => !g.invitationCard);

    if (pendingGuests.length === 0) {
      toast.success('All guests already have cards');
      return;
    }

    // ─── Show confirmation ──────────────────────────────────────────────
    const confirm = await new Promise<boolean>((resolve) => {
      toast.custom(
        (t) => (
          <div
            className={`${t.visible ? 'animate-enter' : 'animate-leave'
              } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex flex-col overflow-hidden border border-gray-200`}
          >
            <div className="p-4 bg-brand">
              <h3 className="text-white font-semibold text-base">Generate Invitation Cards</h3>
            </div>
            <div className="p-4">
              <p className="text-gray-700 text-sm mb-1">
                <span className="font-bold text-brand">{pendingGuests.length}</span> guests need cards
              </p>
              <p className="text-gray-500 text-xs mb-4">
                {guests.filter((g) => g.invitationCard).length} guests already have cards
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    resolve(true);
                  }}
                  className="flex-1 bg-brand text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-deep transition"
                >
                  Generate {pendingGuests.length} Cards
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    resolve(false);
                  }}
                  className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ),
        { duration: 10000 }
      );
    });

    if (!confirm) return;

    setGeneratingCards(true);
    setGenerationProgress({
      total: pendingGuests.length,
      completed: 0,
      failed: 0,
    });

    const currentToast = toast.loading(`Generating ${pendingGuests.length} cards...`);

    try {
      const BATCH_SIZE = 10;
      let completed = 0;
      let failed = 0;
      let skipped = 0;

      for (let i = 0; i < pendingGuests.length; i += BATCH_SIZE) {
        const batch = pendingGuests.slice(i, i + BATCH_SIZE);

        const res = await fetch('/api/invitations/generate-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: event.id,
            guestIds: batch.map((g) => g.id),
          }),
          credentials: 'include',
        });

        const data = await res.json();

        if (res.ok) {
          completed += data.completed || 0;
          failed += data.failed || 0;
          skipped += data.skipped || 0;
        } else {
          failed += batch.length;
        }

        const progress = Math.min(i + BATCH_SIZE, pendingGuests.length);
        toast.loading(`Generating cards (${progress}/${pendingGuests.length})...`, {
          id: currentToast,
        });

        setGenerationProgress({
          total: pendingGuests.length,
          completed,
          failed,
        });
      }

      if (completed === pendingGuests.length) {
        toast.success(`All ${completed} cards generated successfully!`, { id: currentToast });
      } else if (completed > 0 && failed === 0) {
        toast.success(`${completed} cards generated! ${skipped} already had cards.`, { id: currentToast });
      } else if (completed > 0 && failed > 0) {
        toast(`${completed} generated, ${failed} failed. ${skipped} already had cards.`, {
          id: currentToast,
          icon: <AlertTriangle size={18} className="text-warn" />,
        });
      } else {
        toast.error('Failed to generate any cards.', { id: currentToast });
      }

      await fetchData(eventId!);

      // ─── Show send invitation prompt if cards were generated ──────────
      if (completed > 0) {
        toast.custom(
          (t) => (
            <div
              className={`${t.visible ? 'animate-enter' : 'animate-leave'
                } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex flex-col overflow-hidden border border-gray-200`}
            >
              <div className="p-4 bg-brand">
                <h3 className="text-white font-semibold text-base flex items-center gap-2">
                  <Send size={18} />
                  Cards Ready!
                </h3>
              </div>
              <div className="p-4">
                <p className="text-gray-700 text-sm mb-4">
                  {completed} new cards generated. Would you like to send invitations now?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      toast.dismiss(t.id);
                      goToStep('send');
                    }}
                    className="flex-1 bg-brand text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-deep transition flex items-center justify-center gap-2"
                  >
                    <Send size={16} />
                    Send Invitations
                  </button>
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-gray-200 transition"
                  >
                    Later
                  </button>
                </div>
              </div>
            </div>
          ),
          { duration: 8000 }
        );
      }
    } catch (err) {
      console.error('Generation error:', err);
      toast.error('Network error while generating cards', { id: currentToast });
    } finally {
      setGeneratingCards(false);
      setGenerationProgress(null);
    }
  };

  // ─── Regenerate single guest card ──────────────────────────────────────
  const regenerateGuestCard = async (guest: Guest) => {
    const ok = await confirmToast({ title: `Regenerate card for ${guest.name}?`, confirmText: 'Regenerate' });
    if (!ok) return;

    try {
      const res = await fetch('/api/invitations/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: event?.id,
          guestIds: [guest.id],
        }),
        credentials: 'include',
      });

      const data = await res.json();

      if (res.ok && data.completed > 0) {
        toast.success(`Card regenerated for ${guest.name}`);
        await fetchData(eventId!);
      } else {
        toast.error(data.error || `Failed to regenerate card for ${guest.name}`);
      }
    } catch {
      toast.error('Network error');
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
    const cardDisplay = guest.cardNumber || 'No Card';
    const guestFullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;

    return (
      <div
        key={guest.id}
        className={`bg-white rounded-tap border transition-all hover:shadow-md ${isSelected ? 'border-brand shadow-md' : 'border-gray-100'
          }`}
      >
        <div className="flex items-center p-3 gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelectGuest(guest.id)}
            className="w-4 h-4 rounded border-gray-300 text-brand focus:ring-brand flex-shrink-0"
          />
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-brand to-brand-deep flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {guest.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-800 text-sm truncate">{guestFullName}</p>
              {guest.cardNumber && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                  <Hash size={10} /> #{cardDisplay}
                </span>
              )}
              {guest.cardGroupId && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium text-warn bg-warn-soft px-2 py-0.5 rounded-full"
                  title="Shared 2-person card"
                >
                  <Users size={10} /> 2ppl
                </span>
              )}
              {isCheckedIn && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success-soft px-2 py-0.5 rounded-full">
                  <CheckCircle size={12} /> Checked In
                </span>
              )}
              {hasThanks && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-coral bg-coral/10 px-2 py-0.5 rounded-full">
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
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${isWhatsApp
                    ? 'bg-brand/10 text-brand'
                    : 'bg-gray-100 text-gray-600'
                  }`}
              >
                {isWhatsApp ? <MessageCircle size={11} /> : <Phone size={11} />}
                {isWhatsApp ? 'WhatsApp' : 'SMS'}
              </span>
              {guest.phone && <span className="text-xs text-gray-400 font-mono truncate">{guest.phone}</span>}
              {reminderCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-warn bg-warn-soft px-2 py-0.5 rounded-full">
                  <Clock size={11} /> {reminderCount} reminder{reminderCount > 1 ? 's' : ''}
                </span>
              )}
              {guest.passCode && (
                <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {guest.passCode}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {guest.invitationCard && (
              <button
                onClick={() => {
                  setSelectedCardGuest(guest);
                  setShowCardModal(true);
                }}
                className="p-1.5 text-blue-500 hover:text-blue-700 transition rounded"
                title="View Card"
              >
                <ImageIcon size={15} />
              </button>
            )}
            <button
              onClick={() => deleteGuest(guest.id)}
              className="p-1.5 text-gray-400 hover:text-danger transition rounded"
              title="Delete guest"
            >
              <Trash2 size={15} />
            </button>
            <button
              onClick={() => openEditGuestModal(guest)}
              className="p-1.5 text-gray-400 hover:text-brand transition rounded"
              title="Edit guest"
            >
              <Edit2 size={15} />
            </button>
            {guest.invitationCard && (
              <button
                onClick={() => regenerateGuestCard(guest)}
                className="p-1.5 text-gray-400 hover:text-warn transition rounded"
                title="Regenerate card"
              >
                <RotateCw size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // ─── Render Card Grid Item ────────────────────────────────────────────
  const renderCardItem = (guest: Guest) => {
    if (!guest.invitationCard) return null;
    return (
      <div
        key={guest.id}
        className="bg-white rounded-tap border border-gray-100 overflow-hidden hover:shadow-md transition group"
      >
        <div
          className="relative aspect-[3/4] bg-gray-50 cursor-pointer"
          onClick={() => {
            setSelectedCardGuest(guest);
            setShowCardModal(true);
          }}
        >
          <img
            src={guest.invitationCard}
            alt={`${guest.name}'s invitation`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedCardGuest(guest);
                  setShowCardModal(true);
                }}
                className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition"
                title="View Card"
              >
                <Eye size={18} className="text-gray-700" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (navigator.share) {
                    navigator
                      .share({
                        title: `${guest.name}'s Invitation`,
                        url: guest.invitationCard || '',
                      })
                      .catch(() => { });
                  } else {
                    navigator.clipboard.writeText(guest.invitationCard || '');
                    toast.success('Card link copied to clipboard');
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
                onClick={(e) => e.stopPropagation()}
                className="p-2 bg-white rounded-full shadow-lg hover:bg-gray-50 transition"
                title="Download Card"
              >
                <Download size={18} className="text-gray-700" />
              </a>
            </div>
          </div>
          <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
            {guest.cardGroupId && (
              <span className="text-[10px] font-medium bg-warn text-white px-2 py-0.5 rounded-full">
                2ppl
              </span>
            )}
            <span className="text-xs font-medium bg-brand text-white px-2 py-0.5 rounded-full">
              #{guest.cardNumber || guest.id.slice(0, 6)}
            </span>
          </div>
        </div>
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-gray-800 truncate">
                {guest.title ? `${guest.title} ${guest.name}` : guest.name}
              </p>
              <p className="text-xs text-gray-400 truncate">{guest.phone}</p>
            </div>
            <div className="flex items-center gap-1">
              <span
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${guest.routingChannel === 'whatsapp'
                    ? 'bg-brand/10 text-brand'
                    : 'bg-gray-100 text-gray-600'
                  }`}
              >
                {guest.routingChannel === 'whatsapp' ? 'WA' : 'SMS'}
              </span>
              {guest.checkedIn && (
                <span className="text-[10px] font-medium text-success bg-success-soft px-1.5 py-0.5 rounded-full">
                  ✓
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ─── Loading State ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64 gap-3">
        <Loader2 size={32} className="animate-spin text-brand" />
        <p className="text-sm text-gray-400">Loading event...</p>
      </div>
    );
  }

  if (fetchError || !event) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-white rounded-card shadow-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-danger mx-auto mb-3" />
          <h1 className="font-display text-2xl font-bold text-gray-800 mb-2">
            {fetchError ? 'Failed to Load Event' : 'Event Not Found'}
          </h1>
          <p className="text-gray-500 text-sm mb-5">
            {fetchError ?? "This event doesn't exist or you don't have access to it."}
          </p>
          <div className="flex gap-3 justify-center">
            {fetchError && eventId && (
              <button
                onClick={() => fetchData(eventId)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-brand to-brand-deep text-white text-sm font-bold rounded-tap hover:shadow-md transition"
              >
                <ArrowLeft size={14} /> Retry
              </button>
            )}
            <Link
              href="/client/dashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-bold rounded-tap hover:bg-gray-50 transition"
            >
              <ArrowLeft size={14} /> Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main JSX ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        /* On phones these read as bottom sheets; from sm up they become centred
           dialogs. Only CSS changes, so the modal JSX and state stay as they are. */
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
          display: flex; align-items: flex-end; justify-content: center; z-index: 50; padding: 0;
          animation: fadeIn 0.2s ease both;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .modal-content {
          background: white; border-radius: 24px 24px 0 0; width: 100%; max-width: 100%;
          max-height: 92dvh; overflow-y: auto; overscroll-behavior: contain;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          box-shadow: 0 -8px 40px rgba(0,0,0,0.24);
          animation: sheetUp 0.3s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(24px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (min-width: 640px) {
          .modal-overlay { align-items: center; padding: 16px; }
          .modal-content {
            max-width: 460px; border-radius: 24px; max-height: 90vh; padding-bottom: 0;
            box-shadow: 0 24px 64px rgba(0,0,0,0.2);
            animation: slideUp 0.3s cubic-bezier(0.16,1,0.3,1) both;
          }
        }
        .modal-header {
          position: sticky; top: 0; z-index: 1; background: white;
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 18px 18px 14px; border-bottom: 1px solid var(--color-gray-200);
        }
        @media (min-width: 640px) { .modal-header { padding: 20px 24px 16px; } }
        .modal-title { font-family: 'Playfair Display', serif; font-size: 20px; font-weight: 900; color: var(--color-gray-900); }
        .modal-title span { color: var(--color-coral); }
        .modal-body { padding: 18px 18px 24px; }
        @media (min-width: 640px) { .modal-body { padding: 20px 24px 24px; } }
        .modal-close {
          width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid var(--color-gray-200);
          background: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; color: var(--color-gray-400);
          transition: border-color 0.15s, color 0.15s;
        }
        .modal-close:hover { border-color: var(--color-danger); color: var(--color-danger); }
        .modal-close:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 2px; }
        .field-label { display: block; font-size: 13px; font-weight: 600; color: var(--color-gray-600); margin-bottom: 5px; }
        .field-input {
          width: 100%; padding: 12px 14px; border: 1.5px solid var(--color-gray-200); border-radius: 11px;
          font-size: 14px; outline: none; color: var(--color-gray-900); background: white; font-weight: 500;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .field-input:focus { border-color: var(--color-brand); box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-brand) 8%, transparent); }
        .btn-primary {
          background: linear-gradient(135deg, var(--color-brand), var(--color-brand-deep)); color: white;
          padding: 13px 20px; border-radius: 13px; font-weight: 700; font-size: 14px;
          border: none; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 14px color-mix(in srgb, var(--color-brand) 32%, transparent); transition: transform 0.15s, box-shadow 0.15s;
        }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 22px color-mix(in srgb, var(--color-brand) 40%, transparent); }
        .btn-primary:disabled { opacity: 0.55; cursor: not-allowed; }
        .btn-secondary {
          padding: 13px 20px; border-radius: 13px; font-weight: 700; font-size: 14px;
          border: 1.5px solid var(--color-gray-200); background: white; color: var(--color-gray-600);
          cursor: pointer; transition: border-color 0.15s, color 0.15s;
        }
        .btn-secondary:hover { border-color: var(--color-brand); color: var(--color-brand); }
        .card-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(12px);
          display: flex; align-items: center; justify-content: center; z-index: 100; padding: 16px;
          animation: fadeIn 0.3s ease both;
        }
        .card-modal-content {
          background: transparent; max-width: 90vh; max-height: 90vh; width: 100%;
          position: relative;
        }
        .card-modal-content img {
          width: 100%; height: 100%; object-fit: contain; border-radius: 12px;
          box-shadow: 0 24px 64px rgba(0,0,0,0.3);
        }
        .step-pill {
          display: flex; flex-direction: column; align-items: center; gap: 4px; flex: 1; padding: 8px 2px;
          cursor: pointer; position: relative;
        }
        .step-circle {
          width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-weight: 700; font-size: 13px; transition: all 0.2s; border: 2px solid var(--color-gray-200);
          background: white; color: var(--color-gray-400);
        }
        .step-pill.done .step-circle { background: var(--color-brand); border-color: var(--color-brand); color: white; }
        .step-pill.active .step-circle {
          background: var(--color-brand); border-color: var(--color-brand); color: white; box-shadow: 0 0 0 4px color-mix(in srgb, var(--color-brand) 15%, transparent);
        }
        .step-label { font-size: 11px; font-weight: 600; color: var(--color-gray-400); }
        .step-pill.active .step-label, .step-pill.done .step-label { color: var(--color-brand); }
        .step-count { font-size: 9.5px; font-weight: 700; color: var(--color-gray-400); }
        .step-pill.done .step-count { color: var(--color-brand); }
        .step-pill.active .step-count { color: var(--color-coral); }
        .step-line { position: absolute; top: 17px; left: 50%; width: 100%; height: 2px; background: var(--color-gray-200); z-index: -1; }
        .step-pill.done .step-line { background: var(--color-brand); }
        .step-pill:first-child .step-line { display: none; }
        .action-tile {
          display: flex; align-items: center; gap: 12px; background: white;
          border: 1.5px solid var(--color-gray-200); border-radius: 16px; padding: 16px;
          transition: all 0.15s; text-align: left; width: 100%;
        }
        .action-tile:hover { border-color: var(--color-brand); box-shadow: 0 4px 14px color-mix(in srgb, var(--color-brand) 10%, transparent); transform: translateY(-1px); }
        .action-tile-icon {
          width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
      `}</style>

      <div>
        <div className="max-w-3xl mx-auto px-3 sm:px-6 py-4">
          {/* ─── Top Navigation ─── */}
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/client/dashboard"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-brand bg-white border border-brand/20 rounded-tap px-3.5 py-1.5 transition hover:bg-brand/10"
            >
              <ArrowLeft size={14} /> Back
            </Link>

            <div className="relative" ref={manageMenuRef}>
              <button
                ref={manageMenuButtonRef}
                onClick={() => setShowManageMenu((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={showManageMenu}
                aria-label="Manage event"
                className="w-11 h-11 grid place-items-center text-gray-500 bg-white border border-gray-200 rounded-tap hover:bg-gray-50 active:bg-gray-100 transition"
                title="Manage"
              >
                <MoreVertical size={18} />
              </button>
              {showManageMenu && (
                <div
                  role="menu"
                  aria-label="Manage event"
                  className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-card shadow-elev-3 overflow-hidden z-20 animate-enter"
                >
                  <p className="px-4 pt-3 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    Manage event
                  </p>
                  {!isArchived && (
                    <button
                      role="menuitem"
                      onClick={openEditModal}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50 transition"
                    >
                      <Pencil size={15} className="text-gray-400" /> Edit event details
                    </button>
                  )}
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowManageMenu(false);
                      router.push(`/client/check-in?event=${event.id}`);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50 transition"
                  >
                    <QrCode size={15} className="text-gray-400" /> Check-in guests
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowManageMenu(false);
                      router.push(`/client/events/${event.id}/remind`);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50 transition"
                  >
                    <Bell size={15} className="text-gray-400" /> Remind guests{' '}
                    {guests.length > 0 && (
                      <span className="ml-auto text-xs text-warn font-bold">{guests.length}</span>
                    )}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => {
                      setShowManageMenu(false);
                      router.push(`/client/events/${event.id}/contributions`);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50 transition"
                  >
                    <Coins size={15} className="text-gray-400" /> Contributions
                  </button>
                  {checkedInCount > 0 && (
                    <button
                      role="menuitem"
                      onClick={openThanksModal}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:bg-gray-50 transition"
                    >
                      <Heart size={15} className="text-gray-400" /> Send thank-you
                    </button>
                  )}
                  {isEventDisabled && canResume && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setShowManageMenu(false);
                        handleResumeEvent();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-success hover:bg-success-soft transition"
                    >
                      <RotateCw size={15} /> Resume event
                    </button>
                  )}
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={async () => {
                      setShowManageMenu(false);
                      const confirmed = await confirmToast({
                        title: 'Delete this event?',
                        message: 'This action cannot be undone. All guests will be permanently removed.',
                        confirmText: 'Delete',
                        danger: true,
                      });
                      if (!confirmed) return;
                      try {
                        const res = await fetch(`/api/events/${eventId}`, {
                          method: 'DELETE',
                          credentials: 'include',
                        });
                        if (res.ok) {
                          toast.success('Event deleted');
                          router.push('/client/events');
                        } else {
                          const data = await res.json();
                          toast.error(data.error || 'Failed to delete event');
                        }
                      } catch {
                        toast.error('Network error. Please try again.');
                      }
                    }}
                    role="menuitem"
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-danger hover:bg-danger-soft transition"
                  >
                    <Trash2 size={15} /> Delete event
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ─── Event Header ─── */}
          <div className="bg-white rounded-card border border-gray-200/80 shadow-elev-1 p-4 mb-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-display text-xl sm:text-2xl font-black text-gray-900 truncate">
                    {event.name}
                  </h1>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusBadge.className}`}
                  >
                    {statusBadge.icon}
                    {statusBadge.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                  <span className="flex items-center gap-1">
                    <Calendar size={12} className="text-brand" />
                    {format(new Date(event.date), 'PPP')}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin size={12} className="text-brand" />
                    {event.venue}
                  </span>
                </div>
              </div>
              {!isEventDisabled && eventDate && (
                <EventCountdown key={countdownKey} targetDate={event.date} />
              )}
            </div>

            {isExpired && (
              <div className="mt-3 bg-danger-soft border border-danger-border rounded-tap px-3 py-2">
                <p className="text-xs font-semibold text-danger flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  {canResume
                    ? `Paused - ${daysRemainingToResume.toFixed(0)} days left to resume.`
                    : 'Archived and cannot be resumed.'}
                </p>
              </div>
            )}

            {/* Quick glance stats. dt precedes dd in the DOM for screen readers
                ("Guests, 42"); flex-col-reverse puts the number on top visually. */}
            <dl className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-gray-100">
              <div className="flex flex-col-reverse items-center">
                <dt className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">Guests</dt>
                <dd className="font-display text-lg font-black text-gray-900">{guests.length}</dd>
              </div>
              <div className="flex flex-col-reverse items-center">
                <dt className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">Cards</dt>
                <dd className="font-display text-lg font-black text-brand">{guestsWithCards.length}</dd>
              </div>
              <div className="flex flex-col-reverse items-center">
                <dt className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">Sent</dt>
                <dd className="font-display text-lg font-black text-gray-900">{sentCount}</dd>
              </div>
              <div className="flex flex-col-reverse items-center">
                <dt className="text-[9px] font-semibold text-gray-400 uppercase tracking-wide">Checked In</dt>
                <dd className="font-display text-lg font-black text-success">{checkedInAll}</dd>
              </div>
            </dl>
          </div>

          {isEventDisabled ? (
            <div className="bg-gray-50 border border-gray-200 rounded-card p-6 text-center">
              <AlertCircle size={24} className="text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500 font-medium text-sm">
                This event is {event.status === 'ARCHIVED' ? 'archived' : 'paused'}, so the setup flow is disabled.
                {canResume && ' Use the menu above to resume it.'}
              </p>
            </div>
          ) : (
            <>
                  {/* ─── Journey Intro (appears on page entry, animated one-by-one) ─── */}
                  <AnimatePresence>
                    {showJourneyIntro && (
                      <motion.div
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.35, ease: 'easeOut' }}
                        className="bg-gradient-to-br from-brand to-brand-deep rounded-card shadow-sm border border-brand/15 overflow-hidden mb-4"
                      >
                        <div className="px-5 py-4 text-white">
                          <div className="flex items-center gap-2 mb-1.5">
                            <Compass size={16} className="text-coral" />
                            <p className="text-[11px] font-bold tracking-[1.5px] uppercase text-coral/70">Your invitation journey</p>
                            <button
                              onClick={() => setShowJourneyIntro(false)}
                              className="ml-auto p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition"
                              title="Dismiss"
                            >
                              <X size={14} />
                            </button>
                          </div>
                          <p className="text-sm text-white/85 leading-relaxed mb-3">
                            Set up your wedding invitations in <strong>{STEPS.length} simple steps</strong>.
                            You&apos;re on step {stepIndex + 1} of {STEPS.length} right now:
                          </p>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {STEPS.map((s, i) => (
                              <motion.div
                                key={s.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.15 + i * 0.12, duration: 0.35, ease: 'easeOut' }}
                                className={`rounded-tap px-3 py-2.5 flex items-center gap-2 min-w-0 ${
                                  activeStep === s.id ? 'bg-white/15 ring-1 ring-white/25' : 'bg-white/5'
                                }`}
                              >
                                <span className={`shrink-0 ${activeStep === s.id ? 'text-coral' : 'text-white/50'}`}>
                                  {s.icon}
                                </span>
                                <span className={`min-w-0 ${activeStep === s.id ? 'text-white' : 'text-white/55'}`}>
                                  <span className="block text-[9px] font-bold uppercase tracking-wide opacity-70">Step {s.short}</span>
                                  <span className="block text-xs font-semibold truncate">{s.label}</span>
                                </span>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>


              {/* ─── Generation Progress ─── */}
              {generationProgress && (
                <div className="bg-white rounded-tap border border-gray-200 p-4 mb-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Generating cards...</span>
                    <span className="text-sm text-gray-500">
                      {generationProgress.completed + generationProgress.failed} / {generationProgress.total}
                    </span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-brand rounded-full transition-all duration-300"
                      style={{
                        width: `${((generationProgress.completed + generationProgress.failed) /
                            generationProgress.total) *
                          100
                          }%`,
                      }}
                    />
                  </div>
                  {generationProgress.failed > 0 && (
                    <p className="mt-1 text-xs text-danger">
                      {generationProgress.failed} failed
                    </p>
                  )}
                </div>
              )}

              {/* ─── Step 1: Guests ─── */}
              {activeStep === 'guests' && (
                <div className="space-y-4">
                  {/* RSVP feed & wishes - dedicated page */}
                  {(rsvps.length > 0 || wishes.length > 0) ? (
                    <Link
                      href={`/client/events/${event.id}/rsvps`}
                      className="action-tile"
                    >
                      <div className="action-tile-icon bg-indigo-50 text-indigo-600">
                        <PartyPopper size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-800">View RSVPs &amp; wishes</p>
                        <p className="text-xs text-gray-400">
                          {rsvps.length} RSVP{rsvps.length !== 1 ? 's' : ''} &middot; {wishes.length} wish{wishes.length !== 1 ? 'es' : ''}
                        </p>
                      </div>
                      <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
                    </Link>
                  ) : (
                    <Link
                      href={`/client/events/${event.id}/rsvps`}
                      className="action-tile"
                    >
                      <div className="action-tile-icon bg-indigo-50 text-indigo-600">
                        <PartyPopper size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-800">RSVPs &amp; wishes</p>
                        <p className="text-xs text-gray-400">View guest responses and wishes as they come in</p>
                      </div>
                      <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
                    </Link>
                  )}

                  <Link
                    href={`/client/events/${event.id}/remind`}
                    className="action-tile"
                  >
                    <div className="action-tile-icon bg-whatsapp/10 text-success">
                      <Bell size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm text-gray-800">Remind guests</p>
                      <p className="text-xs text-gray-400">
                        Send SMS or WhatsApp reminders ({guests.length} guests)
                      </p>
                    </div>
                    <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
                  </Link>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Link href={`/client/guests/import/${event.id}`} className="action-tile">
                      <div className="action-tile-icon bg-brand/10 text-brand">
                        <Upload size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-800">Import guest list</p>
                        <p className="text-xs text-gray-400">Upload a spreadsheet of guests</p>
                      </div>
                      <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
                    </Link>
                    <Link href={`/client/guests/add/${event.id}`} className="action-tile">
                      <div className="action-tile-icon bg-warn-soft text-warn">
                        <Plus size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-800">Add a single guest</p>
                        <p className="text-xs text-gray-400">
                          Enter one guest by hand (add a plus-one to share a card)
                        </p>
                      </div>
                      <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
                    </Link>
                  </div>

                  <div className="bg-white rounded-card shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex flex-wrap items-center gap-2 p-3 border-b border-gray-100">
                      <div className="flex-1 min-w-[120px] relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={searchTerm}
                          onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setCurrentPage(1);
                          }}
                          placeholder="Search guests..."
                          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                        />
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={toggleSelectAll}
                          className="p-2 text-gray-500 hover:text-brand rounded-lg hover:bg-gray-50 transition"
                          title="Select All"
                        >
                          {selectedGuests.size === guests.length && guests.length > 0 ? (
                            <CheckSquare size={16} />
                          ) : (
                            <Square size={16} />
                          )}
                        </button>
                        {selectedGuests.size > 0 && (
                          <button
                            onClick={deleteSelected}
                            disabled={deleting}
                            className="p-2 text-danger hover:bg-danger-soft rounded-lg transition disabled:opacity-50"
                            title="Delete Selected"
                          >
                            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          </button>
                        )}
                        <button
                          onClick={openBackupModal}
                          className="p-2 text-brand hover:bg-brand/10 rounded-lg transition"
                          title="View All Guests"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </div>

                    {guests.length === 0 ? (
                      <div className="py-12 text-center">
                        <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <h3 className="font-display text-lg font-bold text-gray-800 mb-1">No guests yet</h3>
                        <p className="text-sm text-gray-400">
                          Import a guest list or add guests manually to get started.
                        </p>
                      </div>
                    ) : (
                      <div>
                        <div
                          id="guest-list-container"
                          className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto scroll-smooth p-1"
                          onScroll={handleScroll}
                        >
                          {paginatedGuests.map(renderGuestCard)}
                        </div>

                        {totalPages > 1 && (
                          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                            <span className="text-xs text-gray-500">
                              {(currentPage - 1) * pageSize + 1} -{' '}
                              {Math.min(currentPage * pageSize, filteredGuests.length)} of {filteredGuests.length}
                            </span>
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
                          <button
                            onClick={scrollToTop}
                            className="fixed bottom-[calc(var(--app-nav-h)+1rem)] lg:bottom-24 right-4 sm:right-6 bg-brand text-white p-3 rounded-full shadow-brand-sm hover:bg-brand-800 transition z-10"
                          >
                            <ArrowUp size={20} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── Step 2: Design ─── */}
              {activeStep === 'design' && (
                <div className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Link href={`/client/invitations/design/${event.id}`} className="action-tile">
                      <div className="action-tile-icon bg-brand/10 text-brand">
                        <Palette size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-800">Open the card designer</p>
                        <p className="text-xs text-gray-400">
                          Choose a template and customize colors, text and photos
                        </p>
                      </div>
                      <ArrowRight size={16} className="text-gray-300 flex-shrink-0" />
                    </Link>
<button
                      type="button"
                      onClick={() => setShowGuestPageEditor(v => !v)}
                      className={`action-tile ${showGuestPageEditor ? 'border-brand' : ''}`}
                    >
                      <div className="action-tile-icon bg-brand/10 text-brand">
                        <QrCode size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-gray-800">Guest page &amp; Invitation</p>
                        <p className="text-xs text-gray-400">
                          Colors, photos, theme &amp; wording shown to this event&apos;s guests
                        </p>
                      </div>
                      <ChevronDown size={16} className={`text-gray-300 flex-shrink-0 transition-transform ${showGuestPageEditor ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {showGuestPageEditor && (
                    <GuestPageThemeEditor
                      key={event.id}
                      apiUrl={`/api/events/${event.id}/guest-page`}
                      uploadUrl={`/api/events/${event.id}/guest-page/upload`}
                      backHref={`/client/events/${event.id}`}
                      title="Guest page & invitation"
                      description="Colors, photos, theme, contacts & wording shown to this event's guests"
                      draftKey={`guestPage_${event.id}`}
                      embedded
                    />
                  )}

                  <div className="bg-white rounded-card shadow-sm border border-gray-100 p-5 text-center">
                    <PenTool size={28} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      Design one invitation template - it gets used to generate a personalized card for every
                      guest in the next step.
                    </p>
                  </div>
                </div>
              )}

              {/* ─── Step 3: Generate ─── */}
              {activeStep === 'generate' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-card shadow-sm border border-gray-100 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-sm text-gray-800">
                          {guestsWithoutCards.length} guest{guestsWithoutCards.length !== 1 ? 's' : ''} need cards
                        </p>
                        <p className="text-xs text-gray-400">{guestsWithCards.length} already generated</p>
                      </div>
                      <button
                        onClick={handleGenerateCards}
                        disabled={generatingCards || guests.length === 0}
                        className="bg-brand text-white px-4 py-2.5 rounded-tap text-sm font-bold hover:bg-brand-deep transition disabled:opacity-50 flex items-center gap-2"
                      >
                        {generatingCards ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Wand size={16} />
                        )}
                        {generatingCards
                          ? 'Generating...'
                          : guestsWithoutCards.length === 0
                            ? 'All Done'
                            : `Generate ${guestsWithoutCards.length} Card${guestsWithoutCards.length !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  </div>

                  {guestsWithCards.length > 0 && (
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setCardView('grid')}
                        className={`p-2 rounded-lg transition ${cardView === 'grid'
                            ? 'bg-brand text-white'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                          }`}
                        title="Grid View"
                      >
                        <Grid3x3 size={16} />
                      </button>
                      <button
                        onClick={() => setCardView('list')}
                        className={`p-2 rounded-lg transition ${cardView === 'list'
                            ? 'bg-brand text-white'
                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                          }`}
                        title="List View"
                      >
                        <List size={16} />
                      </button>
                    </div>
                  )}

                  {guestsWithCards.length === 0 ? (
                    <div className="bg-white rounded-card border border-gray-100 p-10 text-center">
                      <ImageIcon size={40} className="text-gray-300 mx-auto mb-3" />
                      <h3 className="font-display text-base font-bold text-gray-800 mb-1">No cards yet</h3>
                      <p className="text-sm text-gray-400">
                        Generate personalized invitation cards for your guests.
                      </p>
                    </div>
                  ) : cardView === 'grid' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{guestsWithCards.map(renderCardItem)}</div>
                  ) : (
                    <div className="bg-white rounded-card border border-gray-100 overflow-hidden">
                      <div className="divide-y divide-gray-100">
                        {guestsWithCards.map((guest) => (
                          <div
                            key={guest.id}
                            className="flex items-center gap-3 p-3 hover:bg-gray-50 transition cursor-pointer"
                            onClick={() => {
                              setSelectedCardGuest(guest);
                              setShowCardModal(true);
                            }}
                          >
                            <img
                              src={guest.invitationCard!}
                              alt={guest.name}
                              className="w-14 h-14 rounded-lg object-cover border border-gray-100 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-800 truncate">
                                {guest.title ? `${guest.title} ${guest.name}` : guest.name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="truncate">{guest.phone}</span>
                                <span
                                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100`}
                                >
                                  {guest.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedCardGuest(guest);
                                  setShowCardModal(true);
                                }}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                                title="View Card"
                              >
                                <Eye size={16} />
                              </button>
                              <a
                                href={guest.invitationCard!}
                                download={`${guest.name}-invitation.png`}
                                onClick={(e) => e.stopPropagation()}
                                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                                title="Download Card"
                              >
                                <Download size={16} />
                              </a>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  regenerateGuestCard(guest);
                                }}
                                className="p-2 text-gray-400 hover:text-warn rounded-lg transition"
                                title="Regenerate Card"
                              >
                                <RotateCw size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Step 4: Send ─── */}
              {activeStep === 'send' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-card shadow-sm border border-gray-100 p-4">
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="text-center bg-gray-50 rounded-tap py-3">
                        <p className="text-lg font-bold text-gray-900">{guests.length}</p>
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Guests</p>
                      </div>
                      <div className="text-center bg-gray-50 rounded-tap py-3">
                        <p className="text-lg font-bold text-brand">{whatsappCount}</p>
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">WhatsApp</p>
                      </div>
                      <div className="text-center bg-gray-50 rounded-tap py-3">
                        <p className="text-lg font-bold text-gray-600">{smsCount}</p>
                        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">SMS</p>
                      </div>
                    </div>
                    {guestsWithoutCards.length > 0 && (
                      <div className="bg-warn-soft border border-warn-border rounded-tap px-3 py-2 mb-4 flex items-center gap-2">
                        <AlertCircle size={14} className="text-warn flex-shrink-0" />
                        <p className="text-xs font-medium text-warn">
                          {guestsWithoutCards.length} guest{guestsWithoutCards.length !== 1 ? 's' : ''} still
                          don&apos;t have a card generated.
                        </p>
                      </div>
                    )}
                    <Link
                      href={`/client/invitations/send/${event.id}`}
                      className="w-full bg-gradient-to-r from-brand to-brand-deep text-white text-center py-3.5 rounded-tap font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 text-sm"
                    >
                      <Send size={16} /> {sentCount > 0 ? 'Continue sending' : 'Send invitations'}
                    </Link>
                  </div>

                  {sentCount > 0 && (
                    <div className="bg-white rounded-card border border-gray-100 p-4 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-success-soft flex items-center justify-center text-success flex-shrink-0">
                        <CheckCircle size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-800">
                          {sentCount} of {guests.length} invitations sent
                        </p>
                        <p className="text-xs text-gray-400">
                          You can resend to anyone who hasn&apos;t received theirs yet.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─── Bottom Sticky Step Navigation (animated) ─── */}
              {/* Sits above the mobile tab bar via --app-nav-h. */}
              <div className="fixed bottom-[var(--app-nav-h)] left-0 right-0 bg-white/95 backdrop-blur border-t border-gray-200 px-3 sm:px-6 py-3 z-30">
                <div className="max-w-3xl mx-auto flex items-center gap-3">
                  <button
                    onClick={() => stepIndex > 0 && goToStep(STEPS[stepIndex - 1].id)}
                    disabled={stepIndex === 0}
                    aria-label={
                      stepIndex === 0
                        ? 'Already at the first step'
                        : `Back to step ${stepIndex}: ${STEPS[stepIndex - 1].label}`
                    }
                    className="btn-secondary !px-3 flex-shrink-0 disabled:opacity-40"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={activeStep}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        aria-live="polite"
                        className="text-center min-w-0"
                      >
                        <p className="text-xs font-semibold text-gray-800 truncate flex items-center justify-center gap-1.5">
                          <span className="text-gray-400 font-medium">
                            Step {stepIndex + 1} of {STEPS.length}
                          </span>
                          <span className="inline-flex items-center text-brand">{STEPS[stepIndex].icon}</span>
                          <span className="truncate">{STEPS[stepIndex].label}</span>
                        </p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">{nextUp}</p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  {stepIndex < STEPS.length - 1 ? (
                    <button onClick={goNextStep} className="btn-primary flex-shrink-0 max-w-[52%]">
                      <span className="truncate">
                        Continue to {STEPS[stepIndex + 1].label}
                      </span>
                      <ArrowRight size={16} className="shrink-0" />
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push('/client/dashboard')}
                      className="btn-primary flex-shrink-0"
                    >
                      Done <Check size={16} />
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Card Detail Modal ─── */}
      {showCardModal && selectedCardGuest && (
        <div
        role="dialog"
        aria-modal="true"
        aria-label="Card preview"
        className="card-modal-overlay"
        onClick={() => setShowCardModal(false)}
      >
          <div className="card-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <button
                onClick={() => setShowCardModal(false)}
                className="absolute -top-12 right-0 text-white hover:text-gray-300 transition p-2"
              >
                <X size={28} />
              </button>
              <img
                src={selectedCardGuest.invitationCard!}
                alt={`${selectedCardGuest.name}'s invitation card`}
                className="w-full h-auto max-h-[85vh] object-contain rounded-tap"
              />
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3 bg-black/60 backdrop-blur-sm p-2 rounded-tap">
                <button
                  onClick={() => {
                    if (navigator.share) {
                      navigator
                        .share({
                          title: `${selectedCardGuest.name}'s Invitation`,
                          url: selectedCardGuest.invitationCard || '',
                        })
                        .catch(() => { });
                    } else {
                      navigator.clipboard.writeText(selectedCardGuest.invitationCard || '');
                      toast.success('Card link copied');
                    }
                  }}
                  className="p-2.5 bg-white rounded-lg hover:bg-gray-100 transition"
                  title="Share"
                >
                  <Share2 size={18} className="text-gray-700" />
                </button>
                <a
                  href={selectedCardGuest.invitationCard!}
                  download={`${selectedCardGuest.name}-invitation.png`}
                  className="p-2.5 bg-white rounded-lg hover:bg-gray-100 transition"
                  title="Download"
                >
                  <Download size={18} className="text-gray-700" />
                </a>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(selectedCardGuest.invitationCard || '');
                    toast.success('Card link copied');
                  }}
                  className="p-2.5 bg-white rounded-lg hover:bg-gray-100 transition"
                  title="Copy Link"
                >
                  <Link2 size={18} className="text-gray-700" />
                </button>
                <button onClick={() => window.print()} className="p-2.5 bg-white rounded-lg hover:bg-gray-100 transition" title="Print">
                  <Printer size={18} className="text-gray-700" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Kumbusha Modal ─── */}
  {showKumbushaModal && (
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Kumbusha guests"
    className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowKumbushaModal(false);
          }}
        >
          <div className="modal-content">
            <div className="modal-header">
              <div className="modal-title">
                Kumbusha <span>Michango</span>
              </div>
              <button className="modal-close" onClick={() => setShowKumbushaModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div className="bg-gray-50 rounded-tap p-4 mb-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand/10 flex items-center justify-center text-brand">
                  <Users size={18} />
                </div>
                <div>
                  <p className="text-xs text-gray-400">Wageni waliopo</p>
                  <p className="font-bold text-gray-800">{kumbushaCount} SMS guests pending</p>
                </div>
              </div>
              <div
                className={`rounded-tap p-4 mb-4 flex items-center gap-3 ${isFree ? 'bg-success-soft border border-success-border' : 'bg-warn-soft border border-warn-border'
                  }`}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl">
                  {isFree ? (
                    <Check size={20} className="text-success" />
                  ) : (
                    <Coins size={20} className="text-warn" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {isFree ? 'Kumbusho 2 za kwanza bure' : `Gharama: ${kumbushaTotalCost} TZS`}
                  </p>
                  {credits !== null && <p className="text-xs text-gray-400">Salio: {credits} TZS</p>}
                </div>
              </div>
              <label className="field-label">Ujumbe wa kukumbusha</label>
              <textarea
                className="w-full p-3 border border-gray-200 rounded-tap focus:ring-2 focus:ring-brand focus:border-transparent resize-none text-sm"
                rows={3}
                value={kumbushaMessage}
                onChange={(e) => setKumbushaMessage(e.target.value)}
                placeholder="Andika ujumbe hapa..."
              />
              <div className="text-right text-xs text-gray-400 mt-1">{kumbushaMessage.length} herufi</div>
              <div className="flex gap-3 mt-4">
                <button className="flex-1 btn-secondary" onClick={() => setShowKumbushaModal(false)}>
                  Ghairi
                </button>
                <button
                  className="flex-1 btn-primary"
                  onClick={sendKumbusha}
                  disabled={
                    sendingKumbusha ||
                    !kumbushaMessage.trim() ||
                    (kumbushaTotalCost > 0 && credits !== null && credits < kumbushaTotalCost)
                  }
                >
                  {sendingKumbusha ? <Loader2 size={18} className="animate-spin" /> : <Bell size={18} />}
                  {sendingKumbusha ? 'Inatuma...' : 'Tuma Ukumbusho'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Thanks Card Modal ─── */}
      <ThanksCardModal
        open={showThanksModal}
        eventId={eventId!}
        event={event}
        guests={guests}
        isBypassed={!!event?.tenant?.bypassPayment}
        credits={credits}
        onClose={() => setShowThanksModal(false)}
        onSent={() => { fetchCredits(); fetchData(eventId!); }}
      />

      {/* ─── Edit Event Modal ─── */}
  {showEditModal && (
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Edit event details"
    className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditModal(false);
          }}
        >
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div className="modal-title">
                Update <span>Event</span>
              </div>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-body">
              <div className="space-y-4">
                <div>
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
                <div>
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
                <div>
                  <label className="field-label">Address</label>
                  <input
                    type="text"
                    name="address"
                    value={editForm.address}
                    onChange={handleEditChange}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label">Date & Time</label>
                  <input
                    type="datetime-local"
                    name="date"
                    value={editForm.date}
                    onChange={handleEditChange}
                    className="field-input"
                    min={new Date().toISOString().slice(0, 16)}
                    disabled={checkedInAll > 0}
                    required
                  />
                  {checkedInAll > 0 && (
                    <p className="mt-1.5 text-[11px] leading-snug text-warn bg-warn-soft border border-warn-border rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                      <Lock size={12} />
                      Date/time is locked because {checkedInAll} guest{checkedInAll > 1 ? 's have' : ' has'} already checked in.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button type="button" className="flex-1 btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
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
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Edit guest"
    className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditGuestModal(false);
          }}
        >
          <div className="modal-content" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div className="modal-title">
                Update <span>Guest</span>
              </div>
              <button className="modal-close" onClick={() => setShowEditGuestModal(false)}>
                <X size={16} />
              </button>
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
                <button type="button" className="flex-1 btn-secondary" onClick={() => setShowEditGuestModal(false)}>
                  Cancel
                </button>
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
  <div
    role="dialog"
    aria-modal="true"
    aria-label="Backup guests"
    className="modal-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBackupModal(false);
          }}
        >
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div className="modal-title">
                All <span>Guests</span>
              </div>
              <button className="modal-close" onClick={() => setShowBackupModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              {backupLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 size={24} className="animate-spin text-brand" />
                </div>
              ) : (
                <>
                  <div className="relative mb-4">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={backupSearch}
                      onChange={(e) => {
                        setBackupSearch(e.target.value);
                        setBackupPage(1);
                      }}
                      placeholder="Search all guests..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-brand focus:border-transparent"
                    />
                  </div>

                  {backupPaginated.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                      <p>No guests found</p>
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                      {backupPaginated.map((g) => (
                        <div key={g.id} className="py-2.5 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-soft flex items-center justify-center text-brand font-bold text-sm flex-shrink-0">
                            {g.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm text-gray-800 truncate">
                              {g.title ? `${g.title} ${g.name}` : g.name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span className="truncate">{g.phone || 'No phone'}</span>
                              <span>•</span>
                              <span
                                className={`inline-flex items-center gap-1 ${g.checkedIn ? 'text-success' : 'text-warn'
                                  }`}
                              >
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
                        <button
                          onClick={() => setBackupPage((p) => Math.max(1, p - 1))}
                          disabled={backupPage === 1}
                          className="px-3 py-1 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1 text-sm font-semibold text-gray-700">
                          {backupPage} / {backupTotalPages}
                        </span>
                        <button
                          onClick={() => setBackupPage((p) => Math.min(backupTotalPages, p + 1))}
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
    </>
  );
}