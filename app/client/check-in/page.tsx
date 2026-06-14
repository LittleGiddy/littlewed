'use client';
import { useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { QrCode, Key, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import jsQR from 'jsqr';

export default function CheckInPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');
  const [mode, setMode] = useState<'qr' | 'manual'>('qr');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [guestName, setGuestName] = useState('');
  const [scanning, setScanning] = useState(false);
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

  const processCheckinWithToken = async (token: string) => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ Checked in');
        setGuestName(data.guest.name);
        toast.success(`Welcome, ${data.guest.name}!`);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch {
      setMessage('❌ Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsCode: code }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setMessage('✅ Checked in');
        setGuestName(data.guest.name);
        toast.success(`Welcome, ${data.guest.name}!`);
        setCode('');
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch {
      setMessage('❌ Network error');
    } finally {
      setLoading(false);
    }
  };

  if (!eventId) return <div className="p-4 text-center">Missing event ID</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href={`/client/events/${eventId}`}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] rounded-xl px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.14)] mb-6"
      >
        ← Back to Event
      </Link>

      <h1 className="font-serif text-3xl md:text-4xl font-black text-gray-900 mb-2">Venue Check‑in</h1>
      <p className="text-gray-500 text-sm mb-6">Scan guest QR code or enter 6‑digit SMS code</p>

      {/* Mode Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('qr')}
          className={`flex-1 py-2 rounded-xl font-semibold transition ${mode === 'qr' ? 'bg-[#0D4F4F] text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          <QrCode size={16} className="inline mr-1" /> QR Scanner
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 rounded-xl font-semibold transition ${mode === 'manual' ? 'bg-[#0D4F4F] text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
        >
          <Key size={16} className="inline mr-1" /> Manual Code
        </button>
      </div>

      {/* QR Scanner */}
      {mode === 'qr' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
          </div>
          {scanning && (
            <p className="text-center text-sm text-gray-500 mt-2">Position QR code in the frame</p>
          )}
        </div>
      )}

      {/* Manual Code Entry */}
      {mode === 'manual' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <form onSubmit={handleManualCheckIn} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">6‑digit code</label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full p-3 text-center text-2xl tracking-widest font-mono border rounded-lg focus:ring-2 focus:ring-[#0D4F4F]"
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
        <div className={`mt-6 p-4 rounded-xl text-center font-medium ${message.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message}
        </div>
      )}
      {guestName && (
        <div className="mt-4 text-center text-gray-600">
          Welcome, <span className="font-semibold">{guestName}</span>!
        </div>
      )}
    </div>
  );
}