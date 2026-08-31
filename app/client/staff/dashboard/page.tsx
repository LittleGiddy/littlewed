'use client';
import { useRef, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Search, CheckCircle, XCircle, Users, Camera, Key, Calendar,
  ChevronRight, Scan, Loader2, User, UserCheck, CheckCheck, Trash2, ArrowLeft,
  Info, PartyPopper
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsQR from 'jsqr';
import { showCheckInWelcome } from '@/app/components/CheckInWelcomeToast';

interface Guest {
  id: string;
  name: string;
  title: string | null;
  cardNumber: string | null;
  guestType: string | null;
  checkInCount: number;
  checkedIn: boolean;
  checkedInAt: string | null;
  phone: string | null;
  routingChannel: string;
  createdAt: string;
}

interface Event {
  id: string;
  name: string;
  date: string;
}

const playSound = (type: 'success' | 'fail') => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
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
    // Silent fail if audio context not supported
  }
};

const getFullName = (guest: Guest) => guest.title ? `${guest.title} ${guest.name}` : guest.name;

const getGuestTypeLabel = (type: string | null) => {
  if (!type) return 'SINGLE';
  return type.toUpperCase();
};

const getCheckInStatus = (guest: Guest) => {
  const max = guest.guestType?.toUpperCase() === 'DOUBLE' ? 2 : 1;
  const count = guest.checkInCount || 0;
  if (count >= max) return { label: 'Fully Checked In', color: 'text-green-600 bg-green-50', icon: CheckCheck };
  if (count > 0) return { label: `Partial (${count}/${max})`, color: 'text-amber-600 bg-amber-50', icon: UserCheck };
  return { label: 'Not Scanned', color: 'text-gray-400 bg-gray-50', icon: User };
};

export default function StaffDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingGuests, setLoadingGuests] = useState(false);

  const [activeTab, setActiveTab] = useState<'scan' | 'data'>('scan');
  const [cardNumber, setCardNumber] = useState('');
  const [loadingCheckin, setLoadingCheckin] = useState(false);
  const [message, setMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [scannedGuest, setScannedGuest] = useState<Guest | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [forceCheckinGuest, setForceCheckinGuest] = useState<Guest | null>(null);

  const [blockedMessage, setBlockedMessage] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanning, setScanning] = useState(false);

  // ─── Auth + load events ────────────────────────────────────────────
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (session?.user?.role !== 'STAFF') router.push('/login');
    if (session) {
      fetch('/api/events', { credentials: 'include' })
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setEvents(data); })
        .catch(() => toast.error('Failed to load events'))
        .finally(() => setLoading(false));
    }
  }, [session, status, router]);

  // ─── Load guests for selected event ────────────────────────────────
  const loadGuests = async (eventId: string) => {
    setSelectedEventId(eventId);
    setSearchTerm('');
    setLoadingGuests(true);
    try {
      const res = await fetch(`/api/events/${eventId}/guests?_=${Date.now()}`, { credentials: 'include' });
      const data = await res.json();
      if (Array.isArray(data)) setGuests(data);
      else setGuests([]);
    } catch {
      setGuests([]);
    } finally {
      setLoadingGuests(false);
    }
  };

  // ─── QR Scanner ────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'scan' || !selectedEventId) return;
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
          setScanning(true);
        }
      } catch {
        toast.error('Camera access denied or not available');
      }
    };
    startCamera();

    return () => {
      if (stream) stream.getTracks().forEach(track => track.stop());
      setScanning(false);
    };
  }, [activeTab, selectedEventId]);

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !scanning) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) {
      requestAnimationFrame(scanFrame);
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const qr = jsQR(imageData.data, canvas.width, canvas.height);
    if (qr) {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
      }
      setScanning(false);
      processCheckin(qr.data);
    } else {
      requestAnimationFrame(scanFrame);
    }
  };

  useEffect(() => {
    if (scanning) requestAnimationFrame(scanFrame);
  }, [scanning]);

  // ─── Core check-in (uses cardNumber field, matches client/check-in) ──
  const processCheckin = async (value: string) => {
    setLoadingCheckin(true);
    setMessage('');
    setShowSuccess(false);
    setScannedGuest(null);
    setBlockedMessage('');
    setScannedGuest(null);

    try {
      const cleanValue = value.trim().padStart(5, '0');
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNumber: cleanValue }),
        credentials: 'include',
      });
      const data = await res.json();

      if (res.status === 403 && data.availableAt) {
        playSound('fail');
        setBlockedMessage(data.error);
        setShowSuccess(false);
        return;
      }

      if (res.ok) {
        const guest = data.guest;
        const isFully = guest.fullyCheckedIn;
        const max = guest.maxCheckIns || 1;
        const count = guest.checkInCount || 1;
        const fullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;

        playSound('success');
        setScannedGuest(guest);
        setShowSuccess(true);
        setMessage(data.message || 'Checked in successfully');

        const welcomeSub = isFully && max > 1
          ? `Fully checked in (${count}/${max})`
          : max > 1
            ? `Checked in (${count}/${max})`
            : undefined;

        showCheckInWelcome({
          name: fullName,
          subtitle: welcomeSub,
          onDismiss: () => router.refresh(),
        });

        await loadGuests(selectedEventId);

        setTimeout(() => {
          setShowSuccess(false);
          setScannedGuest(null);
          setMessage('');
          setCardNumber('');
          if (activeTab === 'scan') {
            setScanning(true);
            requestAnimationFrame(scanFrame);
          }
        }, 4000);
      } else {
        playSound('fail');
        setMessage(data.error || 'Check-in failed');
        toast.error(data.error || 'Check-in failed');
        setShowSuccess(false);
      }
    } catch {
      playSound('fail');
      setMessage('Network error');
      setShowSuccess(false);
    } finally {
      setLoadingCheckin(false);
    }
  };

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || cardNumber.length !== 5) {
      toast.error('Please enter a valid 5-digit card number');
      return;
    }
    await processCheckin(cardNumber);
    setCardNumber('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // ─── Force check-in ─────────────────────────────────────────────────
  const handleForceCheckin = async (guest: Guest) => {
    try {
      const res = await fetch(`/api/guests/${guest.id}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkedIn: true }),
        credentials: 'include',
      });
      if (res.ok) {
        toast.success(`${getFullName(guest)} force checked in`);
        await loadGuests(selectedEventId);
        setForceCheckinGuest(null);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to force check in');
      }
    } catch {
      toast.error('Network error');
    }
  };

  // ─── Delete guest ──────────────────────────────────────────────────
  const handleDeleteGuest = async (guest: Guest) => {
    try {
      const res = await fetch(`/api/guests/${guest.id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success(`${getFullName(guest)} deleted`);
        await loadGuests(selectedEventId);
        setSelectedGuest(null);
        setShowDeleteConfirm(false);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete guest');
      }
    } catch {
      toast.error('Network error');
    }
  };

  // ─── Derived data ──────────────────────────────────────────────────
  const filteredGuests = guests.filter(g => {
    const name = getFullName(g).toLowerCase();
    const card = g.cardNumber || '';
    return name.includes(searchTerm.toLowerCase()) || card.includes(searchTerm);
  });

  const totalGuests = guests.length;
  const fullyCheckedIn = guests.filter(g => {
    const max = g.guestType?.toUpperCase() === 'DOUBLE' ? 2 : 1;
    return (g.checkInCount || 0) >= max;
  }).length;
  const partiallyCheckedIn = guests.filter(g => {
    const max = g.guestType?.toUpperCase() === 'DOUBLE' ? 2 : 1;
    return (g.checkInCount || 0) > 0 && (g.checkInCount || 0) < max;
  }).length;
  const notCheckedIn = totalGuests - fullyCheckedIn - partiallyCheckedIn;

  const selectedEvent = events.find(e => e.id === selectedEventId);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#0D4B4B]" />
      </div>
    );
  }
  if (!session || session.user?.role !== 'STAFF') return null;

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <style jsx global>{`
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeInUp { animation: fadeInUp 0.4s ease-out forwards; }
        input, select, textarea { font-size: 16px !important; }
        @media (max-width: 640px) {
          .qr-scanner-container { max-height: 50vh; }
        }
      `}</style>

      <div className="max-w-lg mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <Link href="/client/dashboard" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4B4B] bg-white border border-[rgba(13,75,75,0.12)] rounded-xl px-3 py-1.5 transition hover:bg-[rgba(13,75,75,0.06)] mb-3 sm:mb-4">
          <ArrowLeft size={14} /> Back
        </Link>

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
            <div className="text-[11px] font-bold tracking-[1.5px] uppercase text-[#0D4B4B] mb-0.5">Staff Portal</div>
            <h1 className="font-serif text-2xl sm:text-3xl font-black text-gray-900">Staff <span className="text-[#FF6B5C]">Check-in</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D4B4B] bg-white border border-[rgba(13,75,75,0.12)] rounded-full px-3 py-1.5">
              <Users size={13} /> {fullyCheckedIn}/{totalGuests} in
            </span>
          </div>
        </div>

        {/* ─── Event selector ─── */}
        <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 shadow-sm">
          <label className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase text-[#0D4B4B] mb-1.5">
            <Calendar size={13} /> Select Event
          </label>
          <select
            value={selectedEventId}
            onChange={e => loadGuests(e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent outline-none bg-white"
          >
            <option value="">- Choose an event -</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>
                {e.name} · {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </option>
            ))}
          </select>
        </div>

        {/* ─── No event selected ─── */}
        {!selectedEventId && (
          <div className="text-center py-12 text-gray-500">
            <PartyPopper size={36} className="mx-auto mb-2 text-gray-300" />
            <p className="font-medium">Select an event to start checking in guests</p>
          </div>
        )}

        {selectedEventId && (
          <>
            {/* ─── Event info + tabs ─── */}
            {selectedEvent && (
              <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 shadow-sm">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar size={14} className="text-[#FF6B5C] flex-shrink-0" />
                  <span className="font-semibold text-gray-800 truncate">{selectedEvent.name}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {new Date(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            )}

            <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 mb-3 shadow-sm">
              <button
                onClick={() => setActiveTab('scan')}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition flex items-center justify-center gap-1.5 ${activeTab === 'scan' ? 'bg-[#0D4B4B] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Scan size={16} /> Scan
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition flex items-center justify-center gap-1.5 ${activeTab === 'data' ? 'bg-[#0D4B4B] text-white shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                <Users size={16} /> Data
              </button>
            </div>

            {/* ─── Scan tab ─── */}
            {activeTab === 'scan' && (
              <>
                <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3 sm:p-4">
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-square qr-scanner-container">
                    <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                    {!scanning && !loadingCheckin && (
                      <div className="absolute inset-0 flex items-center justify-center text-white bg-black/40">
                        <Camera size={32} className="animate-pulse" />
                      </div>
                    )}
                    {loadingCheckin && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <Loader2 size={32} className="animate-spin text-white" />
                      </div>
                    )}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 sm:w-48 h-40 sm:h-48 border-2 border-white/50 rounded-lg">
                        <div className="absolute top-0 left-0 w-5 sm:w-6 h-5 sm:h-6 border-t-4 border-l-4 border-[#FF6B5C] rounded-tl" />
                        <div className="absolute top-0 right-0 w-5 sm:w-6 h-5 sm:h-6 border-t-4 border-r-4 border-[#FF6B5C] rounded-tr" />
                        <div className="absolute bottom-0 left-0 w-5 sm:w-6 h-5 sm:h-6 border-b-4 border-l-4 border-[#FF6B5C] rounded-bl" />
                        <div className="absolute bottom-0 right-0 w-5 sm:w-6 h-5 sm:h-6 border-b-4 border-r-4 border-[#FF6B5C] rounded-br" />
                      </div>
                    </div>
                  </div>
                  <p className="text-center text-xs sm:text-sm text-gray-500 mt-2 sm:mt-3">
                    Position QR code in the frame
                  </p>
                </div>

                {/* Manual entry */}
                <div className="mt-3 sm:mt-4 bg-white rounded-2xl shadow-lg border border-gray-100 p-3 sm:p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Key size={16} className="text-[#0D4B4B] flex-shrink-0" />
                    <span className="font-medium text-sm text-gray-700">Manual Entry</span>
                  </div>
                  <form onSubmit={handleManualCheckIn} className="space-y-3">
                    <input
                      ref={inputRef}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      className="w-full p-3 text-center text-xl tracking-[6px] font-mono border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-gray-50"
                      placeholder="00000"
                      maxLength={5}
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      disabled={loadingCheckin || cardNumber.length !== 5}
                      className="w-full py-3 bg-[#0D4B4B] text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      {loadingCheckin ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                      Check In
                    </button>
                  </form>
                </div>

                {/* Blocked (event not started) */}
                {blockedMessage && (
                  <div className="mt-3 sm:mt-4 p-3 sm:p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-center text-sm">
                    <div className="flex items-center justify-center gap-1.5 font-medium">
                      <Info size={15} /> Check-in not available yet
                    </div>
                    <p className="text-xs mt-1 opacity-90">{blockedMessage}</p>
                  </div>
                )}

                {/* Message / success */}
                {message && !blockedMessage && (
                  <div className={`mt-3 sm:mt-4 p-3 sm:p-4 rounded-2xl text-center font-medium transition-all text-sm ${showSuccess ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                    {message}
                  </div>
                )}

                {scannedGuest && showSuccess && (
                  <div className="mt-3 sm:mt-4 bg-white rounded-2xl shadow-lg border border-green-200 p-3 sm:p-4 animate-fadeInUp">
                    <div className="flex items-center gap-3">
                      <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                        <CheckCircle size={16} className="text-green-600 sm:text-2xl" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-800 text-sm sm:text-base truncate">{getFullName(scannedGuest)}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                          <span className="font-mono">#{scannedGuest.cardNumber}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${scannedGuest.guestType?.toUpperCase() === 'DOUBLE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                            {getGuestTypeLabel(scannedGuest.guestType)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-xs flex-shrink-0">
                        <span className="text-green-600 font-medium">
                          {scannedGuest.checkInCount || 1}/{scannedGuest.guestType?.toUpperCase() === 'DOUBLE' ? 2 : 1}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ─── Data tab ─── */}
            {activeTab === 'data' && (
              <>
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 mb-3 sm:mb-4">
                  <div className="bg-white rounded-xl border border-gray-200 p-2 text-center shadow-sm">
                    <p className="text-base sm:text-lg font-bold text-gray-800">{totalGuests}</p>
                    <p className="text-[8px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-wider">Total</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-2 text-center shadow-sm">
                    <p className="text-base sm:text-lg font-bold text-green-600">{fullyCheckedIn}</p>
                    <p className="text-[8px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-wider">Fully In</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-2 text-center shadow-sm">
                    <p className="text-base sm:text-lg font-bold text-amber-500">{partiallyCheckedIn}</p>
                    <p className="text-[8px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-wider">Partial</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200 p-2 text-center shadow-sm">
                    <p className="text-base sm:text-lg font-bold text-gray-400">{notCheckedIn}</p>
                    <p className="text-[8px] sm:text-[10px] font-medium text-gray-400 uppercase tracking-wider">Not In</p>
                  </div>
                </div>

                <div className="relative mb-3 sm:mb-4">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or card number..."
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent text-sm sm:text-base"
                  />
                </div>

                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {loadingGuests ? (
                    <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin text-[#0D4B4B]" /></div>
                  ) : filteredGuests.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      <Users size={32} className="mx-auto mb-2 text-gray-300" />
                      <p className="font-medium">No guests found</p>
                      <p className="text-sm text-gray-400">Try adjusting your search</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
                      {filteredGuests.map(guest => {
                        const status = getCheckInStatus(guest);
                        const StatusIcon = status.icon;
                        const max = guest.guestType?.toUpperCase() === 'DOUBLE' ? 2 : 1;
                        const count = guest.checkInCount || 0;
                        const isFully = count >= max;
                        return (
                          <div key={guest.id} onClick={() => setSelectedGuest(guest)} className={`px-3 py-2.5 hover:bg-gray-50 transition cursor-pointer ${isFully ? 'bg-green-50/30' : ''}`}>
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-gradient-to-br from-[#0D4B4B] to-[#0A3939] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                                {guest.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 text-xs sm:text-sm truncate">{getFullName(guest)}</p>
                                <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs">
                                  <span className="font-mono text-gray-400 text-[10px] sm:text-xs">#{guest.cardNumber}</span>
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium ${guest.guestType?.toUpperCase() === 'DOUBLE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {getGuestTypeLabel(guest.guestType)}
                                  </span>
                                  {guest.routingChannel === 'whatsapp' && (
                                    <span className="text-[9px] sm:text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">WA</span>
                                  )}
                                  <StatusIcon size={11} className={status.color.split(' ')[0]} />
                                </div>
                              </div>
                              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ─── Guest Detail Modal ─── */}
      {selectedGuest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedGuest(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden mx-2" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">Guest Details</h3>
              <button onClick={() => setSelectedGuest(null)} className="text-gray-400 hover:text-gray-600 p-1"><XCircle size={20} /></button>
            </div>
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-full bg-gradient-to-br from-[#0D4B4B] to-[#0A3939] flex items-center justify-center text-white font-bold text-base sm:text-lg flex-shrink-0">
                  {selectedGuest.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-bold text-gray-800 text-sm sm:text-base">{getFullName(selectedGuest)}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
                    <span className="font-mono">#{selectedGuest.cardNumber}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${selectedGuest.guestType?.toUpperCase() === 'DOUBLE' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {getGuestTypeLabel(selectedGuest.guestType)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-400">Check-in Status</p>
                  <p className="font-medium text-sm">{selectedGuest.checkInCount || 0}/{selectedGuest.guestType?.toUpperCase() === 'DOUBLE' ? 2 : 1}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-400">Channel</p>
                  <p className="font-medium text-sm capitalize">{selectedGuest.routingChannel || 'SMS'}</p>
                </div>
                {selectedGuest.phone && (
                  <div className="bg-gray-50 rounded-lg p-2 col-span-2">
                    <p className="text-[10px] text-gray-400">Phone</p>
                    <p className="font-medium text-sm">{selectedGuest.phone}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => { setForceCheckinGuest(selectedGuest); setSelectedGuest(null); }} className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-medium text-sm hover:bg-amber-600 transition flex items-center justify-center gap-1.5">
                  <UserCheck size={14} /> Force
                </button>
                <button onClick={() => { setShowDeleteConfirm(true); setSelectedGuest(null); }} className="flex-1 py-2 bg-red-500 text-white rounded-lg font-medium text-sm hover:bg-red-600 transition flex items-center justify-center gap-1.5">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Force Confirm ─── */}
      {forceCheckinGuest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 sm:p-6 mx-2">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3"><UserCheck size={24} className="text-amber-600" /></div>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">Force Check-in?</h3>
              <p className="text-sm text-gray-500 mt-1">
                Force check-in <span className="font-semibold">{getFullName(forceCheckinGuest)}</span>?
                <br /><span className="text-xs text-gray-400">This will mark them as checked in regardless of card type.</span>
              </p>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setForceCheckinGuest(null)} className="flex-1 py-2 border border-gray-200 rounded-lg font-medium text-gray-600 hover:bg-gray-50 transition text-sm">Cancel</button>
                <button onClick={() => handleForceCheckin(forceCheckinGuest)} className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition text-sm">Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm ─── */}
      {showDeleteConfirm && selectedGuest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 sm:p-6 mx-2">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3"><Trash2 size={24} className="text-red-600" /></div>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">Delete Guest?</h3>
              <p className="text-sm text-gray-500 mt-1">
                Are you sure you want to delete <span className="font-semibold">{getFullName(selectedGuest)}</span>?
                <br /><span className="text-xs text-red-500">This action cannot be undone.</span>
              </p>
              <div className="flex gap-3 mt-4">
                <button onClick={() => { setShowDeleteConfirm(false); setSelectedGuest(null); }} className="flex-1 py-2 border border-gray-200 rounded-lg font-medium text-gray-600 hover:bg-gray-50 transition text-sm">Cancel</button>
                <button onClick={() => handleDeleteGuest(selectedGuest)} className="flex-1 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition text-sm">Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
