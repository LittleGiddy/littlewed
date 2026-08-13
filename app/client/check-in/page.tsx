'use client';
import { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QrCode, Key, Loader2, CheckCircle, User, Users, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import jsQR from 'jsqr';

// ─── Sound effects using Web Audio API ────────────────────────────────
const playSound = (type: 'success' | 'fail') => {
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
};

export default function CheckInPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');
  const [mode, setMode] = useState<'qr' | 'manual'>('qr');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestType, setGuestType] = useState('');
  const [checkedIn, setCheckedIn] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState('');
  const [availableAt, setAvailableAt] = useState('');
  const [countdown, setCountdown] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // QR Scanner
  useEffect(() => {
    if (mode !== 'qr') return;
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
      } catch (err) {
        toast.error('Camera access denied or not available');
        setMode('manual');
      }
    };
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setScanning(false);
    };
  }, [mode]);

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
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      setScanning(false);
      processCheckinWithToken(qr.data);
    } else {
      requestAnimationFrame(scanFrame);
    }
  };

  useEffect(() => {
    if (scanning) {
      requestAnimationFrame(scanFrame);
    }
  }, [scanning]);

  // ─── Countdown Timer ────────────────────────────────────────────────
  useEffect(() => {
    if (!availableAt) {
      setCountdown('');
      return;
    }

    const timer = setInterval(() => {
      const target = new Date(availableAt);
      const now = new Date();
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setCountdown('🟢 Available now! Refresh to check in.');
        clearInterval(timer);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown(
        `${hours.toString().padStart(2, '0')}:${minutes
          .toString()
          .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [availableAt]);

  // ─── Core Functions ──────────────────────────────────────────────────
  const processCheckinWithToken = async (token: string) => {
    setLoading(true);
    setMessage('');
    setBlockedMessage('');
    setAvailableAt('');
    setCheckedIn(false);
    try {
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'include',
      });
      const data = await res.json();

      // ─── Event hasn't started yet ──────────────────────────────────────
      if (res.status === 403 && data.availableAt) {
        setBlockedMessage(data.error);
        setAvailableAt(data.availableAt);
        playSound('fail');
        toast.error('Check-in not available yet');
        return;
      }

      if (res.ok) {
        playSound('success');
        setCheckedIn(true);
        setGuestName(data.guest.name);
        setGuestType(data.guest.guestType || '—');
        setMessage('✅ Checked in');
        toast.success(`Welcome, ${data.guest.name}!`);
        setTimeout(() => {
          setCheckedIn(false);
          setMessage('');
          setGuestName('');
          setGuestType('');
        }, 5000);
      } else {
        playSound('fail');
        setMessage(`❌ ${data.error}`);
        toast.error(data.error);
      }
    } catch {
      playSound('fail');
      setMessage('❌ Network error');
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setLoading(true);
    setMessage('');
    setBlockedMessage('');
    setAvailableAt('');
    setCheckedIn(false);
    try {
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsCode: code }),
        credentials: 'include',
      });
      const data = await res.json();

      // ─── Event hasn't started yet ──────────────────────────────────────
      if (res.status === 403 && data.availableAt) {
        setBlockedMessage(data.error);
        setAvailableAt(data.availableAt);
        playSound('fail');
        toast.error('Check-in not available yet');
        setCode('');
        return;
      }

      if (res.ok) {
        playSound('success');
        setCheckedIn(true);
        setGuestName(data.guest.name);
        setGuestType(data.guest.guestType || '—');
        setMessage('✅ Checked in');
        toast.success(`Welcome, ${data.guest.name}!`);
        setCode('');
        setTimeout(() => {
          setCheckedIn(false);
          setMessage('');
          setGuestName('');
          setGuestType('');
        }, 5000);
      } else {
        playSound('fail');
        setMessage(`❌ ${data.error}`);
        toast.error(data.error);
      }
    } catch {
      playSound('fail');
      setMessage('❌ Network error');
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (!eventId) return <div className="p-4 text-center">Missing event ID</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <Link
        href={`/client/events/${eventId}`}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] rounded-xl px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.14)] mb-6"
      >
        ← Back to Event
      </Link>

      <h1 className="font-serif text-3xl md:text-4xl font-black text-gray-900 mb-2">
        Venue Check‑in
      </h1>
      <p className="text-gray-500 text-sm mb-6">
        Scan guest QR code or enter 6‑digit SMS code
      </p>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('qr')}
          className={`flex-1 py-2 rounded-xl font-semibold transition ${
            mode === 'qr'
              ? 'bg-[#0D4F4F] text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <QrCode size={16} className="inline mr-1" /> QR Scanner
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 rounded-xl font-semibold transition ${
            mode === 'manual'
              ? 'bg-[#0D4F4F] text-white shadow-md'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Key size={16} className="inline mr-1" /> Manual Code
        </button>
      </div>

      {/* QR Scanner */}
      {mode === 'qr' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 overflow-hidden">
          <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            {!scanning && !loading && (
              <div className="absolute inset-0 flex items-center justify-center text-white bg-black/40">
                <Loader2 size={32} className="animate-spin" />
              </div>
            )}
          </div>
          {scanning && (
            <p className="text-center text-sm text-gray-500 mt-2">
              Position QR code in the frame
            </p>
          )}
        </div>
      )}

      {/* Manual Code Entry */}
      {mode === 'manual' && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
          <form onSubmit={handleManualCheckIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                6‑digit code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                className="w-full p-3 text-center text-2xl tracking-widest font-mono border rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                placeholder="000000"
                maxLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              {loading ? 'Checking...' : 'Check In'}
            </button>
          </form>
        </div>
      )}

      {/* Result Message */}
      {message && (
        <div
          className={`mt-6 p-4 rounded-2xl text-center font-medium transition-all duration-500 ${
            message.includes('✅')
              ? 'bg-green-100 text-green-800 border border-green-300'
              : 'bg-red-100 text-red-800 border border-red-300'
          }`}
        >
          {message}
        </div>
      )}

      {/* ─── Blocked Message - Event hasn't started ──────────────────── */}
      {blockedMessage && availableAt && (
        <div className="mt-6 p-6 rounded-2xl text-center bg-amber-50 border border-amber-200">
          <div className="flex flex-col items-center gap-3">
            <Clock size={48} className="text-amber-500" />
            <h3 className="text-lg font-bold text-amber-800">
              Check-in Not Available Yet
            </h3>
            <p className="text-amber-700">{blockedMessage}</p>
            {countdown && (
              <>
                <p className="text-3xl font-mono font-bold text-amber-800">
                  {countdown}
                </p>
                <p className="text-sm text-amber-600">until check-in opens</p>
              </>
            )}
            <p className="text-sm text-amber-600 mt-2">
              ⏰ Please wait until the event starts to check in.
            </p>
          </div>
        </div>
      )}

      {/* Guest Details on Check‑in Success */}
      {checkedIn && (
        <div className="mt-6 bg-white rounded-2xl shadow-lg border border-gray-100 p-6 animate-fadeInUp">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle size={28} className="text-green-600" />
            <h2 className="text-xl font-bold text-gray-800">Welcome!</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <User size={20} className="text-[#0D4F4F]" />
              <span className="font-medium">{guestName}</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
              <Users size={20} className="text-[#0D4F4F]" />
              <span className="font-medium">
                {guestType === 'single' ? 'Single' : guestType === 'double' ? 'Double' : guestType || '—'}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Checked in successfully – enjoy the event!
          </p>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeInUp {
          animation: fadeInUp 0.4s ease-out forwards;
        }
      `}</style>
    </div>
  );
}