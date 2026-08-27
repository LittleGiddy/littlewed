'use client';

import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  QrCode, Key, Loader2, CheckCircle, XCircle, User, Users, 
  ArrowLeft, Camera, Smartphone, AlertCircle, Scan, Hash,
  Info, Clock, Calendar, MapPin, Sparkles, Trash2, Eye, 
  ChevronRight, Search, Download, UserPlus, UserCheck,
  CheckCheck, RefreshCw, PartyPopper, Hand, UserRound
} from 'lucide-react';
import toast from 'react-hot-toast';
import jsQR from 'jsqr';

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

// ─── Sound effects ──────────────────────────────────────────────────────
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
  } catch (e) {
    // Silent fail if audio context not supported
  }
};

// ─── Helper: Get guest display name ──────────────────────────────────
const getFullName = (guest: Guest) => {
  return guest.title ? `${guest.title} ${guest.name}` : guest.name;
};

// ─── Helper: Get guest type label ─────────────────────────────────────
const getGuestTypeLabel = (type: string | null) => {
  if (!type) return 'SINGLE';
  return type.toUpperCase();
};

// ─── Helper: Get check-in status ──────────────────────────────────────
const getCheckInStatus = (guest: Guest) => {
  const maxCheckIns = guest.guestType?.toUpperCase() === 'DOUBLE' ? 2 : 1;
  const count = guest.checkInCount || 0;
  
  if (count >= maxCheckIns) {
    return { label: 'Fully Checked In', color: 'text-green-600 bg-green-50', icon: CheckCheck };
  } else if (count > 0) {
    return { label: `Partial (${count}/${maxCheckIns})`, color: 'text-amber-600 bg-amber-50', icon: UserCheck };
  }
  return { label: 'Not Scanned', color: 'text-gray-400 bg-gray-50', icon: User };
};

export default function CheckInPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<'scan' | 'data'>('scan');
  const [cardNumber, setCardNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [scannedGuest, setScannedGuest] = useState<Guest | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [eventInfo, setEventInfo] = useState<{ name: string; venue: string; date: string } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [forceCheckinGuest, setForceCheckinGuest] = useState<Guest | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ─── Load Data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (eventId) {
      loadEventInfo();
      loadGuests();
    }
  }, [eventId]);

  const loadEventInfo = async () => {
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
            year: 'numeric'
          }),
        });
      }
    } catch (error) {
      console.error('Failed to load event info');
    }
  };

  const loadGuests = async () => {
    setLoadingGuests(true);
    try {
      const res = await fetch(`/api/check-in?eventId=${eventId}`, { credentials: 'include' });
      const data = await res.json();
      if (Array.isArray(data)) {
        setGuests(data);
      }
    } catch (error) {
      toast.error('Failed to load guests');
    } finally {
      setLoadingGuests(false);
    }
  };

  // ─── QR Scanner ──────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== 'scan') return;
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play();
          setScanning(true);
        }
      } catch (err) {
        toast.error('Camera access denied');
      }
    };
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setScanning(false);
    };
  }, [activeTab]);

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
    if (scanning) {
      requestAnimationFrame(scanFrame);
    }
  }, [scanning]);

  // ─── Process Check-in ──────────────────────────────────────────────
  const processCheckin = async (value: string) => {
    setLoading(true);
    setMessage('');
    setShowSuccess(false);
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
      
      if (res.ok) {
        const guest = data.guest;
        const isFullyCheckedIn = guest.fullyCheckedIn;
        const maxCheckIns = guest.maxCheckIns || 1;
        const currentCount = guest.checkInCount || 1;
        const fullName = guest.title ? `${guest.title} ${guest.name}` : guest.name;

        playSound('success');
        setScannedGuest(guest);
        setShowSuccess(true);
        setMessage(data.message || 'Checked in successfully');
        
        if (isFullyCheckedIn && maxCheckIns > 1) {
          toast.success(`${fullName} fully checked in (${currentCount}/${maxCheckIns})`, {
            duration: 4000,
            icon: <CheckCheck size={20} className="text-green-600" />,
          });
        } else if (maxCheckIns > 1 && !isFullyCheckedIn) {
          toast.success(`${fullName} checked in (${currentCount}/${maxCheckIns})`, {
            duration: 4000,
            icon: <UserCheck size={20} className="text-amber-500" />,
          });
        } else {
          toast.success(`Welcome ${fullName}`, {
            duration: 4000,
            icon: <Hand size={20} className="text-green-600" />,
          });
        }
        
        loadGuests();
        
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
        toast.error(data.error || 'Check-in failed', {
          icon: <XCircle size={20} className="text-red-500" />,
        });
        setShowSuccess(false);
      }
    } catch (error) {
      playSound('fail');
      setMessage('Network error');
      toast.error('Network error', {
        icon: <AlertCircle size={20} className="text-red-500" />,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || cardNumber.length !== 5) {
      toast.error('Please enter a valid 5-digit card number', {
        icon: <AlertCircle size={18} className="text-amber-500" />,
      });
      return;
    }
    await processCheckin(cardNumber);
    setCardNumber('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // ─── Force Check-in ──────────────────────────────────────────────────
  const handleForceCheckin = async (guest: Guest) => {
    if (!guest) return;
    
    try {
      const res = await fetch(`/api/guests/${guest.id}/checkin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkedIn: true }),
        credentials: 'include',
      });
      
      if (res.ok) {
        const fullName = getFullName(guest);
        toast.success(`${fullName} force checked in`, {
          icon: <UserCheck size={18} className="text-amber-500" />,
        });
        loadGuests();
        setForceCheckinGuest(null);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to force check in', {
          icon: <XCircle size={18} className="text-red-500" />,
        });
      }
    } catch (error) {
      toast.error('Network error', {
        icon: <AlertCircle size={18} className="text-red-500" />,
      });
    }
  };

  // ─── Delete Guest ──────────────────────────────────────────────────
  const handleDeleteGuest = async (guest: Guest) => {
    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (res.ok) {
        const fullName = getFullName(guest);
        toast.success(`${fullName} deleted`, {
          icon: <Trash2 size={18} className="text-red-500" />,
        });
        loadGuests();
        setSelectedGuest(null);
        setShowDeleteConfirm(false);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete guest', {
          icon: <XCircle size={18} className="text-red-500" />,
        });
      }
    } catch (error) {
      toast.error('Network error', {
        icon: <AlertCircle size={18} className="text-red-500" />,
      });
    }
  };

  // ─── Filter guests ──────────────────────────────────────────────────
  const filteredGuests = guests.filter(g => {
    const name = getFullName(g).toLowerCase();
    const card = g.cardNumber || '';
    return name.includes(searchTerm.toLowerCase()) || card.includes(searchTerm);
  });

  // ─── Stats ──────────────────────────────────────────────────────────
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

  if (!eventId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-sm text-center">
          <AlertCircle size={48} className="text-red-500 mx-auto mb-3" />
          <h2 className="font-semibold text-lg text-gray-800">Missing Event ID</h2>
          <p className="text-sm text-gray-500 mt-1">Please select an event first.</p>
          <button
            onClick={() => router.push('/client/dashboard')}
            className="mt-4 px-6 py-2 bg-[#0D4B4B] text-white rounded-xl font-medium"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {/* ─── Viewport meta fix ─── */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeInUp { animation: fadeInUp 0.4s ease-out forwards; }
        
        /* ─── Prevent zoom on input focus ─── */
        input, select, textarea {
          font-size: 16px !important;
        }
        @media (max-width: 640px) {
          input, select, textarea {
            font-size: 16px !important;
          }
          .qr-scanner-container {
            max-height: 50vh;
          }
        }
      `}</style>

      <div className="max-w-lg mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {/* ─── Back Button ─── */}
        <Link
          href={`/client/events/${eventId}`}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4B4B] bg-white border border-[rgba(13,75,75,0.12)] rounded-xl px-3 py-1.5 transition hover:bg-[rgba(13,75,75,0.06)] mb-3 sm:mb-4"
        >
          <ArrowLeft size={14} /> Back
        </Link>

        {/* ─── Event Info ─── */}
        {eventInfo && (
          <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 sm:mb-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles size={14} className="text-[#FF6B5C] flex-shrink-0" />
              <span className="font-semibold text-gray-800 truncate">{eventInfo.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-gray-500 mt-0.5">
              <span className="flex items-center gap-1"><Calendar size={11} className="flex-shrink-0" /> {eventInfo.date}</span>
              <span className="flex items-center gap-1"><MapPin size={11} className="flex-shrink-0" /> {eventInfo.venue}</span>
            </div>
          </div>
        )}

        {/* ─── Tabs ─── */}
        <div className="flex gap-1 bg-white rounded-xl border border-gray-200 p-1 mb-3 sm:mb-4 shadow-sm">
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition flex items-center justify-center gap-1.5 ${
              activeTab === 'scan' 
                ? 'bg-[#0D4B4B] text-white shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Scan size={16} /> Scan
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`flex-1 py-2.5 rounded-lg font-semibold text-sm transition flex items-center justify-center gap-1.5 ${
              activeTab === 'data' 
                ? 'bg-[#0D4B4B] text-white shadow-sm' 
                : 'text-gray-500 hover:bg-gray-50'
            }`}
          >
            <Users size={16} /> Data
          </button>
        </div>

        {/* ─── Scan Tab ─── */}
        {activeTab === 'scan' && (
          <>
            {/* QR Scanner */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-3 sm:p-4">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-square qr-scanner-container">
                <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                {!scanning && !loading && (
                  <div className="absolute inset-0 flex items-center justify-center text-white bg-black/40">
                    <Camera size={32} className="animate-pulse" />
                  </div>
                )}
                {loading && (
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

            {/* Manual Entry - Restructured for mobile */}
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
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').slice(0, 5);
                    setCardNumber(val);
                  }}
                  className="w-full p-3 text-center text-xl tracking-[6px] font-mono border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-gray-50"
                  placeholder="00000"
                  maxLength={5}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={loading || cardNumber.length !== 5}
                  className="w-full py-3 bg-[#0D4B4B] text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                  Check In
                </button>
              </form>
            </div>

            {/* ─── Success Message ─── */}
            {message && (
              <div
                className={`mt-3 sm:mt-4 p-3 sm:p-4 rounded-2xl text-center font-medium transition-all text-sm ${
                  showSuccess
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-800'
                }`}
              >
                {message}
              </div>
            )}

            {/* ─── Scanned Guest Details ─── */}
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
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        scannedGuest.guestType?.toUpperCase() === 'DOUBLE' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
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

        {/* ─── Data Tab ─── */}
        {activeTab === 'data' && (
          <>
            {/* ─── Stats ─── */}
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

            {/* ─── Search ─── */}
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

            {/* ─── Guest List ─── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {loadingGuests ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={24} className="animate-spin text-[#0D4B4B]" />
                </div>
              ) : filteredGuests.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Users size={32} className="mx-auto mb-2 text-gray-300" />
                  <p className="font-medium">No guests found</p>
                  <p className="text-sm text-gray-400">Try adjusting your search</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[400px] sm:max-h-[500px] overflow-y-auto">
                  {filteredGuests.map((guest) => {
                    const status = getCheckInStatus(guest);
                    const StatusIcon = status.icon;
                    const maxCheckIns = guest.guestType?.toUpperCase() === 'DOUBLE' ? 2 : 1;
                    const count = guest.checkInCount || 0;
                    const isFullyCheckedIn = count >= maxCheckIns;

                    return (
                      <div
                        key={guest.id}
                        className={`px-3 py-2.5 hover:bg-gray-50 transition cursor-pointer ${
                          isFullyCheckedIn ? 'bg-green-50/30' : ''
                        }`}
                        onClick={() => setSelectedGuest(guest)}
                      >
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-gradient-to-br from-[#0D4B4B] to-[#0A3939] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                            {guest.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-xs sm:text-sm truncate">
                              {getFullName(guest)}
                            </p>
                            <div className="flex flex-wrap items-center gap-1 sm:gap-2 text-xs">
                              <span className="font-mono text-gray-400 text-[10px] sm:text-xs">#{guest.cardNumber}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-medium ${
                                guest.guestType?.toUpperCase() === 'DOUBLE' 
                                  ? 'bg-purple-100 text-purple-700' 
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {getGuestTypeLabel(guest.guestType)}
                              </span>
                              {guest.routingChannel === 'whatsapp' && (
                                <span className="text-[9px] sm:text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                  WA
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <span className={`text-[9px] sm:text-[10px] font-medium px-1.5 sm:px-2 py-0.5 rounded-full flex items-center gap-0.5 sm:gap-1 ${status.color}`}>
                              <StatusIcon size={9} className="sm:text-xs" />
                              {isFullyCheckedIn ? '✓✓' : count > 0 ? `${count}/${maxCheckIns}` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── Guest Detail Modal ─── */}
      {selectedGuest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedGuest(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden mx-2" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">Guest Details</h3>
              <button onClick={() => setSelectedGuest(null)} className="text-gray-400 hover:text-gray-600 p-1">
                <XCircle size={20} />
              </button>
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
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      selectedGuest.guestType?.toUpperCase() === 'DOUBLE' 
                        ? 'bg-purple-100 text-purple-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {getGuestTypeLabel(selectedGuest.guestType)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-[10px] text-gray-400">Check-in Status</p>
                  <p className="font-medium text-sm">
                    {selectedGuest.checkInCount || 0}/{selectedGuest.guestType?.toUpperCase() === 'DOUBLE' ? 2 : 1}
                  </p>
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
                <button
                  onClick={() => {
                    setForceCheckinGuest(selectedGuest);
                    setSelectedGuest(null);
                  }}
                  className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-medium text-sm hover:bg-amber-600 transition flex items-center justify-center gap-1.5"
                >
                  <UserCheck size={14} /> Force
                </button>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(true);
                    setSelectedGuest(null);
                  }}
                  className="flex-1 py-2 bg-red-500 text-white rounded-lg font-medium text-sm hover:bg-red-600 transition flex items-center justify-center gap-1.5"
                >
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Force Check-in Confirm ─── */}
      {forceCheckinGuest && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5 sm:p-6 mx-2">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
                <UserCheck size={24} className="text-amber-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">Force Check-in?</h3>
              <p className="text-sm text-gray-500 mt-1">
                Force check-in <span className="font-semibold">{getFullName(forceCheckinGuest)}</span>?
                <br />
                <span className="text-xs text-gray-400">This will mark them as checked in regardless of card type.</span>
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setForceCheckinGuest(null)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg font-medium text-gray-600 hover:bg-gray-50 transition text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleForceCheckin(forceCheckinGuest)}
                  className="flex-1 py-2 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition text-sm"
                >
                  Confirm
                </button>
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
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Trash2 size={24} className="text-red-600" />
              </div>
              <h3 className="font-bold text-gray-800 text-sm sm:text-base">Delete Guest?</h3>
              <p className="text-sm text-gray-500 mt-1">
                Are you sure you want to delete <span className="font-semibold">{getFullName(selectedGuest)}</span>?
                <br />
                <span className="text-xs text-red-500">This action cannot be undone.</span>
              </p>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setSelectedGuest(null);
                  }}
                  className="flex-1 py-2 border border-gray-200 rounded-lg font-medium text-gray-600 hover:bg-gray-50 transition text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteGuest(selectedGuest)}
                  className="flex-1 py-2 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}