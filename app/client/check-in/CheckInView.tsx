'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Camera,
  CheckCircle,
  CheckCheck,
  ChevronDown,
  Key,
  Loader2,
  MapPin,
  MessageCircle,
  PartyPopper,
  Phone,
  Scan,
  Search,
  Trash2,
  Undo2,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsQR from 'jsqr';
import { showCheckInWelcome } from '@/app/components/CheckInWelcomeToast';
import { guestTypeBadge, guestTypeMaxScans } from '@/lib/guestTypes';
import { canMarkAsDouble as canMarkAsDoubleRule } from '@/lib/checkin';
import { useReducedMotion } from '@/lib/motion';
import {
  AppAvatar,
  AppBottomSheet,
  AppButton,
  AppCard,
  AppChip,
  AppEmptyState,
  AppField,
  AppSegmentedControl,
  buttonClasses,
  type AppChipTone,
} from '@/components/ui';

interface Guest {
  id: string;
  name: string;
  title: string | null;
  cardNumber: string | null;
  guestType: string | null;
  guestCount?: number | null;
  checkInCount: number;
  checkedIn: boolean;
  checkedInAt: string | null;
  phone: string | null;
  routingChannel: string;
  createdAt: string;
  cardGroupId: string | null;
}

/** The richer shape `/api/check-in` returns for the guest that just scanned. */
interface ScanResult {
  message: string;
  guest: Guest & {
    fullyCheckedIn: boolean;
    maxCheckIns: number;
    sharedGroup?: boolean;
    groupMembers?: { id: string; name: string; checkedIn: boolean }[];
  };
}

type StatusFilter = 'all' | 'fully' | 'partial' | 'not';

/**
 * How long a just-scanned card is ignored if it is scanned again.
 *
 * The camera stays live after a check-in so the next guest in the queue can be
 * scanned immediately, but that means a card still held in front of the lens
 * decodes again on the very next animation frame. Without this lock a DOUBLE
 * guest would be counted twice from one deliberate scan.
 */
const RESCAN_LOCK_MS = 8000;

/** A scan the operator can see and undo, kept for the length of the session. */
interface RecentScan {
  key: number;
  guestId: string;
  name: string;
  guestType: string | null;
  cardNumber: string | null;
  at: number;
  undone: boolean;
}

// ─── Haptics ──────────────────────────────────────────────────────────
// A busy door is loud; the operator often cannot hear the beep. Vibration is
// the channel that still gets through. Android/Chrome only - iOS Safari has no
// Vibration API, so this silently does nothing there.
const playHaptic = (type: 'success' | 'fail' | 'tap') => {
  try {
    if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
    if (type === 'success') navigator.vibrate([18, 60, 18]);
    else if (type === 'fail') navigator.vibrate([45, 70, 45]);
    else navigator.vibrate(10);
  } catch {
    // Never let a missing/blocked vibration API break check-in.
  }
};

// ─── Sound effects ──────────────────────────────────────────────────────
const playSound = (type: 'success' | 'fail') => {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const audioCtx = new Ctor();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === 'success') {
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.4);

      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.frequency.value = 1108;
        osc2.type = 'sine';
        gain2.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc2.start(audioCtx.currentTime);
        osc2.stop(audioCtx.currentTime + 0.3);
      }, 150);
    } else {
      oscillator.frequency.value = 440;
      oscillator.type = 'sawtooth';
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.5);
    }
  } catch {
    // Audio is a nicety - a blocked AudioContext must never break check-in.
  }
};

// ─── Helpers ───────────────────────────────────────────────────────────
const fullName = (guest: Guest) =>
  guest.title ? `${guest.title} ${guest.name}` : guest.name;

const maxScansFor = (guest: Guest) =>
  guestTypeMaxScans(guest.guestType, guest.guestCount);

const classify = (guest: Guest): Exclude<StatusFilter, 'all'> => {
  const max = maxScansFor(guest);
  const count = guest.checkInCount || 0;
  if (count >= max) return 'fully';
  if (count > 0) return 'partial';
  return 'not';
};

function guestTypeTone(guest: Guest): AppChipTone {
  const type = guest.guestType?.toUpperCase();
  if (type === 'DOUBLE') return 'brand';
  if (type === 'FAMILIA') return 'success';
  if (type === 'WAKWE') return 'warn';
  return 'neutral';
}

/**
 * A DOUBLE card can arrive as a pair at the door, so after the first scan the
 * operator is offered "Mark as Double" instead of having to scan the same card
 * a second time. The rules live in lib/checkin.ts.
 */
const canMarkAsDouble = canMarkAsDoubleRule;

const STATUS_META: Record<
  Exclude<StatusFilter, 'all'>,
  { label: string; chip: AppChipTone; active: string }
> = {
  fully: { label: 'Fully in', chip: 'success', active: 'bg-success text-white border-success' },
  partial: { label: 'Partial', chip: 'warn', active: 'bg-warn text-white border-warn' },
  not: { label: 'Not in', chip: 'neutral', active: 'bg-gray-500 text-white border-gray-500' },
};

export default function CheckInView({ eventId }: { eventId: string | null }) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const [activeTab, setActiveTab] = useState<'scan' | 'data'>('scan');
  const [cardNumber, setCardNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastScan, setLastScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const [guests, setGuests] = useState<Guest[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [eventInfo, setEventInfo] = useState<{ name: string; venue: string; date: string } | null>(
    null
  );

  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [forceCheckinGuest, setForceCheckinGuest] = useState<Guest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Guest | null>(null);
  const [busyAction, setBusyAction] = useState(false);

  // ─── New: door-speed affordances ───────────────────────────────────
  /** Bumped on every result so the frame flash can re-trigger. */
  const [flash, setFlash] = useState<{ tone: 'success' | 'fail'; key: number } | null>(null);
  const [recentScans, setRecentScans] = useState<RecentScan[]>([]);
  const [doubleBusy, setDoubleBusy] = useState(false);
  const [undoBusy, setUndoBusy] = useState(false);
  const [showRecent, setShowRecent] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // The decode loop is driven by an effect, so it needs the current handler
  // rather than the one captured when the loop was scheduled.
  const scanHandlerRef = useRef<(value: string) => void>(() => {});
  // card number -> when it was last accepted, used to ignore an immediate re-scan
  // of the same card while it is still in front of the camera.
  const lastScanAtRef = useRef<Record<string, number>>({});
  const recentKeyRef = useRef(0);
  const flashKeyRef = useRef(0);

  // ─── Data loading ───────────────────────────────────────────────────
  const loadEventInfo = useCallback(async () => {
    if (!eventId) return;
    try {
      const res = await fetch(`/api/events/${eventId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.event) {
        setEventInfo({
          name: data.event.name,
          venue: data.event.venue,
          date: new Date(data.event.date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
        });
      }
    } catch {
      // Header is decorative - a failure here should not block check-in.
    }
  }, [eventId]);

  const loadGuests = useCallback(async () => {
    if (!eventId) return;
    setLoadingGuests(true);
    try {
      const res = await fetch(`/api/check-in?eventId=${eventId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Request failed');
      const data = await res.json();
      if (Array.isArray(data)) setGuests(data);
    } catch {
      toast.error('Could not load the guest list');
    } finally {
      setLoadingGuests(false);
    }
  }, [eventId]);

  useEffect(() => {
    void loadEventInfo();
    void loadGuests();
  }, [loadEventInfo, loadGuests]);

  // ─── Camera ─────────────────────────────────────────────────────────
  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setScanning(true);
      } else {
        stopCamera();
      }
    } catch {
      setScanning(false);
      setCameraError('Camera unavailable. Allow access, or type the card number below.');
    }
  }, [stopCamera]);

  // The camera only runs while the Scan tab is on screen.
  useEffect(() => {
    if (activeTab !== 'scan') {
      stopCamera();
      setScanning(false);
      return;
    }
    void startCamera();
    return stopCamera;
  }, [activeTab, startCamera, stopCamera]);

  // Decode loop. Cancelled on unmount or whenever `scanning` flips false.
  useEffect(() => {
    if (!scanning) return;
    let frame = 0;

    const tick = () => {
      frame = requestAnimationFrame(tick);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const qr = jsQR(
        ctx.getImageData(0, 0, canvas.width, canvas.height).data,
        canvas.width,
        canvas.height
      );
      if (qr) {
        // Freeze the feed so the operator sees the same frame they scanned.
        setScanning(false);
        scanHandlerRef.current(qr.data);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [scanning]);

  // ─── Check-in ───────────────────────────────────────────────────────
  const processCheckin = useCallback(
    async (value: string) => {
      const cleanValue = value.trim().padStart(5, '0');

      // Re-scan lock. The camera is restarted immediately after a check-in so
      // the next guest can be scanned without waiting, which means a card still
      // in frame re-decodes instantly. Ignoring the same number for a few
      // seconds is what stops one deliberate scan counting twice.
      const now = Date.now();
      const previous = lastScanAtRef.current[cleanValue];
      if (previous && now - previous < RESCAN_LOCK_MS) {
        return;
      }
      lastScanAtRef.current[cleanValue] = now;

      setLoading(true);
      setErrorMessage('');
      setLastScan(null);

      try {
        const res = await fetch('/api/check-in', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardNumber: cleanValue }),
          credentials: 'include',
        });
        const data = await res.json();

        if (!res.ok) {
          playSound('fail');
          playHaptic('fail');
          flashKeyRef.current += 1;
          setFlash({ tone: 'fail', key: flashKeyRef.current });
          const message = data?.error || 'Check-in failed';
          setErrorMessage(message);
          toast.error(message, { icon: <AlertCircle size={18} className="text-danger" /> });
          // Re-arm the camera so the next guest can be scanned straight away.
          if (activeTab === 'scan') setTimeout(() => startCamera(), 900);
          return;
        }

        playSound('success');
        playHaptic('success');
        flashKeyRef.current += 1;
        setFlash({ tone: 'success', key: flashKeyRef.current });
        setLastScan(data as ScanResult);

        const { guest } = data as ScanResult;
        showCheckInWelcome({
          name: fullName(guest),
          subtitle: guest.maxCheckIns > 1 ? `Checked in ${guest.checkInCount}/${guest.maxCheckIns}` : undefined,
          onDismiss: () => router.refresh(),
        });

        recentKeyRef.current += 1;
        setRecentScans((prev) =>
          [
            {
              key: recentKeyRef.current,
              guestId: guest.id,
              name: fullName(guest),
              guestType: guest.guestType ?? null,
              cardNumber: guest.cardNumber ?? null,
              at: Date.now(),
              undone: false,
            },
            ...prev,
          ].slice(0, 8)
        );

        loadGuests();

        // Bring the camera straight back rather than holding the frozen frame
        // for four seconds. The welcome toast already shows what was scanned,
        // so the operator can keep the queue moving while it is still up.
        if (activeTab === 'scan') startCamera();

        // The result card stays up long enough to press "Mark as Double"; a
        // DOUBLE card needs a longer window because it carries a decision.
        const holdMs = canMarkAsDouble(guest) ? 9000 : 4000;
        setTimeout(() => {
          setLastScan((current) => (current?.guest.id === guest.id ? null : current));
          setErrorMessage('');
        }, holdMs);
      } catch {
        playSound('fail');
        playHaptic('fail');
        flashKeyRef.current += 1;
        setFlash({ tone: 'fail', key: flashKeyRef.current });
        setErrorMessage('Network error. Check your connection and try again.');
        if (activeTab === 'scan') setTimeout(() => startCamera(), 900);
      } finally {
        setLoading(false);
      }
    },
    [activeTab, loadGuests, router, startCamera]
  );

  useEffect(() => {
    scanHandlerRef.current = processCheckin;
  }, [processCheckin]);

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cardNumber.length !== 5) {
      toast.error('Enter the 5-digit card number', {
        icon: <AlertCircle size={18} className="text-warn" />,
      });
      inputRef.current?.focus();
      return;
    }
    await processCheckin(cardNumber);
    setCardNumber('');
    inputRef.current?.focus();
  };

  // ─── Guest actions ──────────────────────────────────────────────────
  const groupMembersFor = (guest: Guest) =>
    guest.cardGroupId ? guests.filter((g) => g.cardGroupId === guest.cardGroupId) : [];

  const handleForceCheckin = async (guest: Guest, allGroup: boolean) => {
    setBusyAction(true);
    try {
      const res = await fetch(`/api/guests/${guest.id}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkedIn: true, allGroup }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to force check in');

      toast.success(data.message || `${fullName(guest)} checked in`, {
        icon: <UserCheck size={18} className="text-success" />,
      });
      setForceCheckinGuest(null);
      setSelectedGuest(null);
      loadGuests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Network error', {
        icon: <AlertCircle size={18} className="text-danger" />,
      });
    } finally {
      setBusyAction(false);
    }
  };

  // ─── Mark as Double ─────────────────────────────────────────────────
  // Marks the whole card arrived in one go. The server already knows how to
  // expand a shared card group or top up a single-row DOUBLE, so this is the
  // same endpoint the "Force in" sheet uses - only the trigger and the wording
  // are different, because here it is the expected action, not a correction.
  const handleMarkAsDouble = async (guest: ScanResult['guest']) => {
    setDoubleBusy(true);
    try {
      const res = await fetch(`/api/guests/${guest.id}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkedIn: true, allGroup: true, label: 'double' }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not mark as double');

      playSound('success');
      playHaptic('success');

      const updated: { id: string; checkInCount?: number; fullyCheckedIn?: boolean }[] = Array.isArray(
        data.updated
      )
        ? data.updated
        : [];
      toast.success(
        updated.length > 1
          ? `All ${updated.length} on this card marked as arrived`
          : `${guest.name} marked as Double`,
        { icon: <UserCheck size={18} className="text-success" /> }
      );

      // Reflect the change in the result card straight away instead of waiting
      // for the guest list to come back.
      setLastScan((current) => {
        if (!current || current.guest.id !== guest.id) return current;
        const byId = new Map(updated.map((u) => [u.id, u]));
        return {
          ...current,
          message: data.message || current.message,
          guest: {
            ...current.guest,
            fullyCheckedIn: true,
            checkInCount: byId.get(current.guest.id)?.checkInCount ?? current.guest.maxCheckIns,
            groupMembers: current.guest.groupMembers?.map((m) => ({
              ...m,
              checkedIn: byId.get(m.id)?.fullyCheckedIn ?? true,
            })),
          },
        };
      });
      setRecentScans((prev) => prev.map((s) => (s.guestId === guest.id ? { ...s, undone: false } : s)));
      loadGuests();
    } catch (error) {
      playSound('fail');
      playHaptic('fail');
      toast.error(error instanceof Error ? error.message : 'Network error', {
        icon: <AlertCircle size={18} className="text-danger" />,
      });
    } finally {
      setDoubleBusy(false);
    }
  };

  // ─── Undo last scan ────────────────────────────────────────────────
  const handleUndo = async (scan: RecentScan) => {
    setUndoBusy(true);
    try {
      const res = await fetch(`/api/guests/${scan.guestId}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ undo: true }),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Could not undo');

      playHaptic('tap');
      setRecentScans((prev) => prev.map((s) => (s.key === scan.key ? { ...s, undone: true } : s)));
      setLastScan((current) =>
        current && current.guest.id === scan.guestId ? null : current
      );
      // Let the operator re-scan the same card straight after an undo.
      if (scan.cardNumber) delete lastScanAtRef.current[scan.cardNumber];
      toast.success(data.message || 'Scan undone', { icon: <Undo2 size={18} className="text-warn" /> });
      loadGuests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Network error', {
        icon: <AlertCircle size={18} className="text-danger" />,
      });
    } finally {
      setUndoBusy(false);
    }
  };

  const handleDeleteGuest = async (guest: Guest) => {    setBusyAction(true);
    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to delete guest');

      toast.success(`${fullName(guest)} deleted`, { icon: <Trash2 size={18} className="text-danger" /> });
      setDeleteTarget(null);
      setSelectedGuest(null);
      loadGuests();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Network error', {
        icon: <AlertCircle size={18} className="text-danger" />,
      });
    } finally {
      setBusyAction(false);
    }
  };

  // ─── Derived list state ─────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = guests.length;
    const fully = guests.filter((g) => classify(g) === 'fully').length;
    const partial = guests.filter((g) => classify(g) === 'partial').length;
    // A WAKWE 30 counts as 30 arrivals, so progress is measured in people
    // rather than records - "arrived" is what the door staff care about.
    const expected = guests.reduce((sum, g) => sum + maxScansFor(g), 0);
    const arrived = guests.reduce((sum, g) => sum + (g.checkInCount || 0), 0);
    return {
      total,
      fully,
      partial,
      notArrived: total - fully - partial,
      expected,
      arrived,
      percent: expected > 0 ? Math.round((arrived / expected) * 100) : 0,
    };
  }, [guests]);

  const filteredGuests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return guests.filter((guest) => {
      if (statusFilter !== 'all' && classify(guest) !== statusFilter) return false;
      if (!term) return true;
      return (
        fullName(guest).toLowerCase().includes(term) ||
        (guest.cardNumber || '').includes(term) ||
        (guest.phone || '').replace(/\s/g, '').includes(term.replace(/\s/g, ''))
      );
    });
  }, [guests, searchTerm, statusFilter]);

  // ─── Missing event ──────────────────────────────────────────────────
  if (!eventId) {
    return (
      <div className="mx-auto w-full max-w-md">
        <AppCard>
          <AppEmptyState
            icon={<AlertCircle size={26} className="text-danger" />}
            title="No event selected"
            description="Pick an event before opening the check-in station."
            action={
              <Link
                href="/client/check-in/select-event"
                className={buttonClasses({ fullWidth: true })}
              >
                Choose an event
              </Link>
            }
            secondaryAction={
              <Link
                href="/client/dashboard"
                className={buttonClasses({ variant: 'ghost', fullWidth: true })}
              >
                Back to dashboard
              </Link>
            }
          />
        </AppCard>
      </div>
    );
  }

  const progressTiles: { key: StatusFilter; label: string; value: number; active: string }[] = [
    { key: 'all', label: 'All', value: stats.total, active: 'bg-brand text-white border-brand' },
    {
      key: 'fully',
      label: 'Fully in',
      value: stats.fully,
      active: STATUS_META.fully.active,
    },
    {
      key: 'partial',
      label: 'Partial',
      value: stats.partial,
      active: STATUS_META.partial.active,
    },
    { key: 'not', label: 'Not in', value: stats.notArrived, active: STATUS_META.not.active },
  ];

  return (
    <div className="checkin-root mx-auto w-full max-w-lg space-y-4 pb-2">
      {/* iOS zooms the viewport when a focused input is under 16px. Scoped to
          this page so it cannot leak into the rest of the app. */}
      <style jsx global>{`
        .checkin-root input,
        .checkin-root select,
        .checkin-root textarea {
          font-size: 16px;
        }
      `}</style>

      {/* ─── Header ─── */}
      <div className="space-y-3">
        <Link
          href={`/client/events/${eventId}`}
          className={buttonClasses({ variant: 'ghost', size: 'sm', className: '-ml-2' })}
        >
          <ArrowLeft size={15} aria-hidden="true" />
          Back to event
        </Link>

        <AppCard tone="raised">
          {eventInfo ? (
            <>
              <div className="flex items-start gap-2.5">
                <PartyPopper size={16} className="text-coral mt-0.5 shrink-0" aria-hidden="true" />
                <h1 className="font-display text-lg font-bold text-gray-900 leading-tight min-w-0 break-words">
                  {eventInfo.name}
                </h1>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500 mt-1.5">
                <span className="flex items-center gap-1">
                  <Calendar size={11} className="shrink-0" aria-hidden="true" />
                  {eventInfo.date}
                </span>
                {eventInfo.venue ? (
                  <span className="flex items-center gap-1 min-w-0">
                    <MapPin size={11} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{eventInfo.venue}</span>
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <div className="h-11 animate-pulse rounded-tap bg-gray-100" aria-hidden="true" />
          )}

          {/* Live arrival count - the number door staff actually watch. */}
          <div className="mt-3.5 pt-3.5 border-t border-gray-100">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[12px] font-semibold text-gray-500">Arrived</span>
              <span className="text-[13px] text-gray-500">
                <span className="font-display text-xl font-black text-gray-900">{stats.arrived}</span>
                <span className="text-gray-400"> / {stats.expected}</span>
              </span>
            </div>
            <div
              className="mt-2 h-2 rounded-full bg-gray-200/70 overflow-hidden"
              role="progressbar"
              aria-valuenow={stats.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Guests arrived"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand transition-[width] duration-500 ease-soft"
                style={{ width: `${stats.percent}%` }}
              />
            </div>
          </div>
        </AppCard>
      </div>

      <AppSegmentedControl
        label="Check-in view"
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: 'scan', label: 'Scan', icon: <Scan size={16} /> },
          {
            value: 'data',
            label: 'Guests',
            icon: <Users size={16} />,
            badge: loadingGuests ? null : stats.total,
          },
        ]}
      />

      {/* ─── Scan tab ─── */}
      {activeTab === 'scan' ? (
        <div className="space-y-4">
          <AppCard padded={false} className="overflow-hidden">
            <div className="p-3 sm:p-4">
              {/* Sized so the frame stays square without eating a whole
                  landscape phone screen. */}
              <div className="relative mx-auto w-full max-w-[min(100%,50vh)] aspect-square rounded-card overflow-hidden bg-gray-900">
                <video
                  ref={videoRef}
                  className="absolute inset-0 w-full h-full object-cover"
                  playsInline
                  muted
                  aria-label="QR scanner camera feed"
                />
                <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

                {!scanning && !loading ? (
                  <div className="absolute inset-0 grid place-items-center bg-gray-900/70 px-6 text-center">
                    <div>
                      <Camera size={30} className="mx-auto text-white/90" aria-hidden="true" />
                      <p className="text-[13px] text-white/90 mt-2.5 leading-snug">
                        {cameraError || 'Starting camera…'}
                      </p>
                      {cameraError ? (
                        <button
                          type="button"
                          onClick={() => void startCamera()}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white backdrop-blur transition hover:bg-white/25"
                        >
                          <Camera size={13} aria-hidden="true" />
                          Try again
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {loading ? (
                  <div className="absolute inset-0 grid place-items-center bg-gray-900/70">
                    <Loader2 size={30} className="animate-spin text-white" aria-hidden="true" />
                  </div>
                ) : null}

                {/* Colour flash: a peripheral cue the operator can read without
                    looking away from the guest. Keyed so it replays per scan. */}
                {flash ? (
                  <motion.div
                    key={flash.key}
                    initial={reducedMotion ? false : { opacity: 0 }}
                    animate={{ opacity: [0, 0.45, 0] }}
                    transition={{ duration: reducedMotion ? 0 : 0.55, times: [0, 0.25, 1] }}
                    aria-hidden="true"
                    className={`absolute inset-0 pointer-events-none ${
                      flash.tone === 'success' ? 'bg-success' : 'bg-danger'
                    }`}
                  />
                ) : null}

                {/* Scan target */}
                <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 sm:w-48 h-40 sm:h-48">
                    <span className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-coral rounded-tl-md" />
                    <span className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-coral rounded-tr-md" />
                    <span className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-coral rounded-bl-md" />
                    <span className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-coral rounded-br-md" />
                  </div>
                </div>
              </div>
              <p className="text-center text-[12px] text-gray-400 mt-3">
                Hold the guest&rsquo;s QR code inside the frame
              </p>
            </div>
          </AppCard>

          <AppCard>
            <div className="flex items-center gap-2 mb-3">
              <Key size={15} className="text-brand shrink-0" aria-hidden="true" />
              <h2 className="text-[13px] font-semibold text-gray-700">Manual entry</h2>
            </div>

            <form onSubmit={handleManualCheckIn} className="space-y-3">
              <AppField label="Card number" hint="The 5 digits printed on the card.">
                {(field) => (
                  <input
                    {...field}
                    ref={inputRef}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={cardNumber}
                    onChange={(e) =>
                      setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 5))
                    }
                    maxLength={5}
                    autoComplete="off"
                    placeholder="00000"
                    className="w-full py-3 text-center text-2xl tracking-[0.4em] font-mono bg-gray-50 focus:bg-white"
                  />
                )}
              </AppField>

              <AppButton
                type="submit"
                size="lg"
                fullWidth
                loading={loading}
                loadingText="Checking in…"
                disabled={cardNumber.length !== 5}
                icon={<CheckCircle size={18} />}
              >
                Check in
              </AppButton>
            </form>
          </AppCard>

          {/* Result is announced to screen readers on every scan. */}
          <div aria-live="polite" aria-atomic="true">
            {errorMessage ? (
              <div className="flex items-start gap-2.5 rounded-card border border-danger-border bg-danger-soft px-4 py-3">
                <AlertCircle size={16} className="text-danger mt-0.5 shrink-0" aria-hidden="true" />
                <p className="text-[13px] font-medium text-danger leading-snug">{errorMessage}</p>
              </div>
            ) : null}

            {lastScan ? (
              <motion.div
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-card border border-success-border bg-success-soft px-4 py-3.5 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <span className="w-10 h-10 rounded-full bg-success/12 grid place-items-center shrink-0">
                    <CheckCircle size={22} className="text-success" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-[15px] leading-tight truncate">
                      {fullName(lastScan.guest)}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <AppChip tone={guestTypeTone(lastScan.guest)}>
                        {guestTypeBadge(lastScan.guest.guestType, lastScan.guest.guestCount)}
                      </AppChip>
                      {lastScan.guest.cardNumber ? (
                        <span className="font-mono text-[11px] text-gray-500">
                          #{lastScan.guest.cardNumber}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  {lastScan.guest.maxCheckIns > 1 ? (
                    <AppChip tone="success" solid className="bg-success text-white shrink-0">
                      {lastScan.guest.checkInCount}/{lastScan.guest.maxCheckIns}
                    </AppChip>
                  ) : null}
                </div>

                {/* Shared DOUBLE cards: show who is still outstanding. */}
                {lastScan.guest.sharedGroup && lastScan.guest.groupMembers?.length ? (
                  <div className="pt-3 border-t border-success-border">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-success mb-2">
                      On this card
                    </p>
                    <ul className="space-y-1.5">
                      {lastScan.guest.groupMembers.map((member) => (
                        <li key={member.id} className="flex items-center gap-2 text-[13px]">
                          {member.checkedIn ? (
                            <CheckCheck size={13} className="text-success shrink-0" aria-hidden="true" />
                          ) : (
                            <User size={13} className="text-gray-400 shrink-0" aria-hidden="true" />
                          )}
                          <span
                            className={
                              member.checkedIn
                                ? 'text-gray-500 line-through'
                                : 'font-medium text-gray-900'
                            }
                          >
                            {member.name}
                          </span>
                          <span className="sr-only">{member.checkedIn ? 'checked in' : 'not yet'}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {/* DOUBLE arriving together: one tap instead of a second scan. */}
                {canMarkAsDouble(lastScan.guest) ? (
                  <div className="pt-3 border-t border-success-border">
                    <AppButton
                      size="lg"
                      fullWidth
                      loading={doubleBusy}
                      loadingText="Marking…"
                      icon={<Users size={17} />}
                      onClick={() => void handleMarkAsDouble(lastScan.guest)}
                    >
                      Mark as Double
                    </AppButton>
                    <p className="mt-1.5 text-center text-[11px] text-gray-500 leading-snug">
                      {lastScan.guest.sharedGroup
                        ? 'Both people arrived together — mark the whole card in one tap instead of scanning again.'
                        : 'Both people arrived together — mark the second person in without scanning again.'}
                    </p>
                  </div>
                ) : null}

                {/* Undo a mis-scan. Offered on the newest entry only, so "undo"
                    can never mean anything ambiguous. */}
                {recentScans[0] && recentScans[0].guestId === lastScan.guest.id ? (
                  <button
                    type="button"
                    disabled={undoBusy}
                    onClick={() => void handleUndo(recentScans[0])}
                    className="w-full inline-flex items-center justify-center gap-1.5 pt-3 mt-1 border-t border-success-border text-[12px] font-semibold text-gray-500 transition hover:text-gray-800 disabled:opacity-50"
                  >
                    {undoBusy ? (
                      <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <Undo2 size={13} aria-hidden="true" />
                    )}
                    Undo this scan
                  </button>
                ) : null}
                </motion.div>
            ) : null}
          </div>

          {/* Recent arrivals. A door queue moves fast and a mis-scan is easy to
              miss, so the last few scans stay on screen with their time. */}
          {recentScans.length > 0 ? (
            <div className="rounded-card border border-gray-100 bg-white overflow-hidden">
              <button
                type="button"
                onClick={() => setShowRecent((v) => !v)}
                aria-expanded={showRecent}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left transition-colors hover:bg-gray-50"
              >
                <span className="flex items-center gap-2 text-[12px] font-semibold text-gray-700">
                  <Users size={13} className="text-brand" aria-hidden="true" />
                  Recent arrivals
                  <span className="font-display text-gray-900">{recentScans.length}</span>
                </span>
                <span className="flex items-center gap-1.5 text-[11px] text-gray-400">
                  {showRecent ? 'Hide' : 'Show'}
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`transition-transform duration-200 ${showRecent ? 'rotate-180' : ''}`}
                  />
                </span>
              </button>

              {showRecent ? (
                <ul className="divide-y divide-gray-50 border-t border-gray-100 max-h-56 overflow-y-auto overscroll-contain">
                  {recentScans.map((scan) => (
                    <li
                      key={scan.key}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13px]"
                    >
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          scan.undone ? 'bg-gray-300' : 'bg-success'
                        }`}
                        aria-hidden="true"
                      />
                      <span
                        className={`min-w-0 flex-1 truncate ${
                          scan.undone
                            ? 'text-gray-400 line-through'
                            : 'font-medium text-gray-800'
                        }`}
                      >
                        {scan.name}
                      </span>
                      {scan.undone ? (
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                          Undone
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] text-gray-400 tabular-nums">
                          {new Date(scan.at).toLocaleTimeString('en-TZ', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ─── Guests tab ─── */}
      {activeTab === 'data' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-2">
            {progressTiles.map((tile) => {
              const selected = statusFilter === tile.key;
              return (
                <button
                  key={tile.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setStatusFilter(selected && tile.key !== 'all' ? 'all' : tile.key)}
                  className={[
                    'rounded-tap border p-2 text-center transition-all duration-150 ease-soft',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    selected
                      ? tile.active
                      : 'bg-white border-gray-200 hover:border-brand/30 active:bg-gray-50',
                  ].join(' ')}
                >
                  <span
                    className={`block font-display text-lg font-black leading-none ${
                      selected ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {tile.value}
                  </span>
                  <span
                    className={`block text-[10px] font-semibold uppercase tracking-wider mt-1 ${
                      selected ? 'text-white/85' : 'text-gray-400'
                    }`}
                  >
                    {tile.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search name, card or phone"
              aria-label="Search guests"
              className="w-full pl-9 pr-9 py-2.5 bg-white border border-gray-200 rounded-tap text-sm placeholder:text-gray-300 focus:outline-none focus:border-brand focus:ring-4 focus:ring-brand/10 transition-all duration-150"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {statusFilter !== 'all' ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] text-gray-500">
                Showing {filteredGuests.length} of {stats.total}
              </span>
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className="text-[12px] font-semibold text-brand hover:underline"
              >
                Show all
              </button>
            </div>
          ) : null}

          <AppCard padded={false} className="overflow-hidden">
            {loadingGuests ? (
              <div className="grid place-items-center py-14" role="status" aria-label="Loading guests">
                <Loader2 size={24} className="animate-spin text-brand" aria-hidden="true" />
              </div>
            ) : filteredGuests.length === 0 ? (
              <AppEmptyState
                size="sm"
                icon={<Users size={22} />}
                title="No guests found"
                description={
                  searchTerm
                    ? 'Try a different name, card number or phone.'
                    : 'Nobody matches this filter yet.'
                }
                action={
                  searchTerm || statusFilter !== 'all' ? (
                    <AppButton
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                      }}
                    >
                      Clear filters
                    </AppButton>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-gray-100 max-h-[26rem] sm:max-h-[30rem] overflow-y-auto overscroll-contain">
                {filteredGuests.map((guest) => {
                  const state = classify(guest);
                  const meta = STATUS_META[state];
                  const count = guest.checkInCount || 0;
                  return (
                    <li key={guest.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedGuest(guest)}
                        className="w-full text-left px-3.5 py-3 flex items-center gap-3 transition-colors duration-150 hover:bg-brand-soft/50 active:bg-brand-soft"
                      >
                        <AppAvatar name={guest.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block font-semibold text-gray-900 text-sm truncate">
                            {fullName(guest)}
                          </span>
                          <span className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="font-mono text-[10px] text-gray-400">
                              #{guest.cardNumber}
                            </span>
                            <AppChip tone={guestTypeTone(guest)} className="!text-[9px] !px-1.5 !py-0.5">
                              {guestTypeBadge(guest.guestType, guest.guestCount)}
                            </AppChip>
                            {guest.routingChannel === 'whatsapp' ? (
                              <AppChip tone="whatsapp" className="!text-[9px] !px-1.5 !py-0.5">
                                <MessageCircle size={9} aria-hidden="true" />
                                WA
                              </AppChip>
                            ) : null}
                          </span>
                        </span>
                        <AppChip
                          tone={meta.chip}
                          className="shrink-0 tabular-nums"
                          icon={
                            state === 'fully' ? (
                              <CheckCheck size={10} />
                            ) : state === 'partial' ? (
                              <UserCheck size={10} />
                            ) : null
                          }
                        >
                          {state === 'not' ? '—' : `${count}/${maxScansFor(guest)}`}
                        </AppChip>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </AppCard>
        </div>
      ) : null}

      {/* ─── Guest details ─── */}
      <AppBottomSheet
        open={Boolean(selectedGuest)}
        onClose={() => setSelectedGuest(null)}
        title="Guest details"
        description={selectedGuest ? fullName(selectedGuest) : undefined}
        footer={
          selectedGuest ? (
            <div className="flex gap-2">
              <AppButton
                variant="secondary"
                size="lg"
                className="flex-1"
                icon={<UserCheck size={16} />}
                onClick={() => {
                  setForceCheckinGuest(selectedGuest);
                  setSelectedGuest(null);
                }}
              >
                Force in
              </AppButton>
              <AppButton
                variant="danger"
                size="lg"
                className="flex-1"
                icon={<Trash2 size={16} />}
                onClick={() => {
                  setDeleteTarget(selectedGuest);
                  setSelectedGuest(null);
                }}
              >
                Delete
              </AppButton>
            </div>
          ) : null
        }
      >
        {selectedGuest ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <AppAvatar name={selectedGuest.name} size="lg" />
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 truncate">{fullName(selectedGuest)}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <AppChip tone={guestTypeTone(selectedGuest)}>
                    {guestTypeBadge(selectedGuest.guestType, selectedGuest.guestCount)}
                  </AppChip>
                  {selectedGuest.cardNumber ? (
                    <span className="font-mono text-[11px] text-gray-500">
                      #{selectedGuest.cardNumber}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-2">
              <div className="rounded-tap bg-gray-50 p-3">
                <dt className="text-[11px] text-gray-400">Check-in</dt>
                <dd className="text-sm font-semibold text-gray-900 mt-0.5 tabular-nums">
                  {selectedGuest.checkInCount || 0}/{maxScansFor(selectedGuest)}
                </dd>
              </div>
              <div className="rounded-tap bg-gray-50 p-3">
                <dt className="text-[11px] text-gray-400">Channel</dt>
                <dd className="text-sm font-semibold text-gray-900 mt-0.5 capitalize">
                  {selectedGuest.routingChannel || 'SMS'}
                </dd>
              </div>
              {selectedGuest.checkedInAt ? (
                <div className="rounded-tap bg-gray-50 p-3 col-span-2">
                  <dt className="text-[11px] text-gray-400">Last scan</dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                    {new Date(selectedGuest.checkedInAt).toLocaleString('en-TZ', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </dd>
                </div>
              ) : null}
              {selectedGuest.phone ? (
                <div className="rounded-tap bg-gray-50 p-3 col-span-2">
                  <dt className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Phone size={10} aria-hidden="true" />
                    Phone
                  </dt>
                  <dd className="text-sm font-semibold text-gray-900 mt-0.5">
                    {selectedGuest.phone}
                  </dd>
                </div>
              ) : null}
            </dl>

            {groupMembersFor(selectedGuest).length > 1 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">
                  {groupMembersFor(selectedGuest).length} guests share this card
                </p>
                <ul className="space-y-1.5">
                  {groupMembersFor(selectedGuest).map((member) => (
                    <li key={member.id} className="flex items-center gap-2 text-[13px] text-gray-700">
                      {member.checkInCount > 0 ? (
                        <CheckCheck size={13} className="text-success shrink-0" aria-hidden="true" />
                      ) : (
                        <User size={13} className="text-gray-300 shrink-0" aria-hidden="true" />
                      )}
                      <span className={member.checkInCount > 0 ? 'line-through text-gray-400' : ''}>
                        {fullName(member)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </AppBottomSheet>

      {/* ─── Force check-in confirm ─── */}
      <AppBottomSheet
        open={Boolean(forceCheckinGuest)}
        onClose={() => setForceCheckinGuest(null)}
        title="Force check-in"
        description={
          forceCheckinGuest
            ? `Marks ${fullName(forceCheckinGuest)} as arrived, ignoring their card type.`
            : undefined
        }
        footer={
          forceCheckinGuest ? (
            <div className="flex flex-col gap-2">
              {groupMembersFor(forceCheckinGuest).length > 1 ? (
                <>
                  <AppButton
                    size="lg"
                    fullWidth
                    loading={busyAction}
                    loadingText="Checking in…"
                    icon={<Users size={16} />}
                    onClick={() => handleForceCheckin(forceCheckinGuest, true)}
                  >
                    All {groupMembersFor(forceCheckinGuest).length} guests
                  </AppButton>
                  <AppButton
                    variant="secondary"
                    size="lg"
                    fullWidth
                    disabled={busyAction}
                    onClick={() => handleForceCheckin(forceCheckinGuest, false)}
                  >
                    Just {fullName(forceCheckinGuest)}
                  </AppButton>
                </>
              ) : (
                <AppButton
                  size="lg"
                  fullWidth
                  loading={busyAction}
                  loadingText="Checking in…"
                  icon={<UserCheck size={16} />}
                  onClick={() => handleForceCheckin(forceCheckinGuest, false)}
                >
                  Confirm check-in
                </AppButton>
              )}
              <AppButton variant="ghost" size="md" fullWidth disabled={busyAction} onClick={() => setForceCheckinGuest(null)}>
                Cancel
              </AppButton>
            </div>
          ) : null
        }
      >
        {forceCheckinGuest ? (
          <div className="flex items-center gap-3 rounded-tap bg-warn-soft p-3.5">
            <UserCheck size={20} className="text-warn shrink-0" aria-hidden="true" />
            <p className="text-[13px] text-gray-700 leading-snug">
              {groupMembersFor(forceCheckinGuest).length > 1
                ? `This card covers ${groupMembersFor(forceCheckinGuest).length} guests.`
                : 'They will be recorded as fully checked in.'}
            </p>
          </div>
        ) : null}
      </AppBottomSheet>

      {/* ─── Delete confirm ─── */}
      <AppBottomSheet
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete guest"
        description={deleteTarget ? fullName(deleteTarget) : undefined}
        footer={
          deleteTarget ? (
            <div className="flex gap-2">
              <AppButton
                variant="ghost"
                size="lg"
                className="flex-1"
                disabled={busyAction}
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </AppButton>
              <AppButton
                variant="danger"
                size="lg"
                className="flex-1"
                loading={busyAction}
                loadingText="Deleting…"
                icon={<Trash2 size={16} />}
                onClick={() => handleDeleteGuest(deleteTarget)}
              >
                Delete
              </AppButton>
            </div>
          ) : null
        }
      >
        {deleteTarget ? (
          <div className="flex items-start gap-3 rounded-tap bg-danger-soft p-3.5">
            <AlertCircle size={20} className="text-danger shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-[13px] text-danger leading-snug">
              This removes the guest and their card. It cannot be undone.
            </p>
          </div>
        ) : null}
      </AppBottomSheet>
    </div>
  );
}
