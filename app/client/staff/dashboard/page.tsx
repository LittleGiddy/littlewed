'use client';
import { useRef, useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Search, CheckCircle, XCircle, Users, Camera, Key, QrCode, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import jsQR from 'jsqr';

interface Guest {
  id: string;
  name: string;
  phone: string;
  checkedIn: boolean;
}

interface Event {
  id: string;
  name: string;
  date: string;
}

export default function StaffDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [filteredGuests, setFilteredGuests] = useState<Guest[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showCheckinModal, setShowCheckinModal] = useState(false);
  const [checkinMode, setCheckinMode] = useState<'qr' | 'manual'>('qr');
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [qrMessage, setQrMessage] = useState('');
  const itemsPerPage = 10;

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (session?.user?.role !== 'STAFF') router.push('/login');
    if (session) {
      fetch('/api/events', { credentials: 'include' })
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setEvents(data); else setEvents([]); })
        .catch(() => toast.error('Failed to load events'))
        .finally(() => setLoading(false));
    }
  }, [session, status, router]);

  const loadGuests = async (eventId: string) => {
    setSelectedEventId(eventId);
    setCurrentPage(1);
    setSearchTerm('');
    const res = await fetch(`/api/events/${eventId}/guests?_=${Date.now()}`, { credentials: 'include' });
    const data = await res.json();
    setGuests(data);
    setFilteredGuests(data);
  };

  useEffect(() => {
    const filtered = guests.filter(g =>
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) || g.phone.includes(searchTerm)
    );
    setFilteredGuests(filtered);
    setCurrentPage(1);
  }, [searchTerm, guests]);

  useEffect(() => {
    if (!showCheckinModal || checkinMode !== 'qr') return;
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
        setCheckinMode('manual');
      }
    };
    startCamera();
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); setScanning(false); };
  }, [showCheckinModal, checkinMode]);

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current || !scanning) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState !== video.HAVE_ENOUGH_DATA) { requestAnimationFrame(scanFrame); return; }
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

  useEffect(() => { if (scanning) requestAnimationFrame(scanFrame); }, [scanning]);

  const processCheckin = async (token: string) => {
    setQrMessage('Checking in…');
    try {
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Checked in: ${data.guest.name}`);
        setQrMessage(`✅ ${data.guest.name} checked in`);
        setTimeout(() => { loadGuests(selectedEventId); setShowCheckinModal(false); setQrMessage(''); }, 1200);
      } else {
        toast.error(data.error);
        setQrMessage(`❌ ${data.error}`);
      }
    } catch {
      toast.error('Network error');
      setQrMessage('❌ Network error');
    }
  };

  const handleManualCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode) return;
    setQrMessage('Checking…');
    try {
      const res = await fetch('/api/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ smsCode: manualCode }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Checked in: ${data.guest.name}`);
        setQrMessage(`✅ ${data.guest.name} checked in`);
        setManualCode('');
        setTimeout(() => { loadGuests(selectedEventId); setShowCheckinModal(false); setQrMessage(''); }, 1200);
      } else {
        toast.error(data.error);
        setQrMessage(`❌ ${data.error}`);
      }
    } catch {
      toast.error('Network error');
      setQrMessage('❌ Network error');
    }
  };

  const totalPages = Math.ceil(filteredGuests.length / itemsPerPage);
  const paginatedGuests = filteredGuests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const checkedInCount = filteredGuests.filter(g => g.checkedIn).length;
  const selectedEvent = events.find(e => e.id === selectedEventId);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}>
        <div style={{ width: 40, height: 40, border: '4px solid #E2EAF0', borderTopColor: '#0D4F4F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!session || session.user?.role !== 'STAFF') return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .sd-wrap {
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          max-width: 860px; margin: 0 auto; padding: 40px 24px 64px;
          animation: sdFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes sdFadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Header ── */
        .sd-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 16px; margin-bottom: 32px; flex-wrap: wrap;
        }
        .sd-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          color: #0D4F4F; text-transform: uppercase; margin-bottom: 6px;
          display: flex; align-items: center; gap: 7px;
        }
        .sd-eyebrow-dot { width: 5px; height: 5px; border-radius: 50%; background: #E8A598; }
        .sd-title {
          font-family: 'Playfair Display', serif;
          font-size: 30px; font-weight: 900; color: #0D1B1B;
          line-height: 1.1; letter-spacing: -0.4px; margin: 0 0 4px;
        }
        .sd-title span { color: #E8A598; }
        .sd-subtitle { font-size: 14px; color: #7A8FA6; margin: 0; }

        /* Header right */
        .sd-header-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; flex-wrap: wrap; }

        .sd-stat-pill {
          display: flex; align-items: center; gap: 8px;
          background: white; border: 1.5px solid #E2EAF0; border-radius: 40px;
          padding: 8px 16px; font-size: 13px; font-weight: 600; color: #4A6072;
          box-shadow: 0 2px 6px rgba(0,0,0,0.04);
        }
        .sd-stat-pill strong { color: #1A7A4A; font-weight: 800; }

        .sd-checkin-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 18px; border: none; border-radius: 13px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 14px; font-weight: 700; font-family: inherit;
          cursor: pointer; white-space: nowrap;
          box-shadow: 0 4px 14px rgba(13,79,79,0.35);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .sd-checkin-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(13,79,79,0.4); }
        .sd-checkin-btn:active { transform: translateY(0); }

        /* ── Event selector ── */
        .sd-card {
          background: white; border: 1.5px solid #E2EAF0; border-radius: 20px;
          overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.05);
          margin-bottom: 20px;
          animation: sdCardIn 0.5s 0.1s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes sdCardIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .sd-card-bar { height: 4px; background: linear-gradient(90deg, #0D4F4F, #E8A598); }
        .sd-card-body { padding: 22px 24px; }

        .sd-select-label {
          font-size: 11px; font-weight: 700; letter-spacing: 1.2px;
          color: #0D4F4F; text-transform: uppercase; margin-bottom: 10px;
          display: flex; align-items: center; gap: 6px;
        }
        .sd-select {
          width: 100%; padding: 13px 16px; border: 1.5px solid #E2EAF0; border-radius: 13px;
          font-size: 14px; font-family: inherit; color: #0D1B1B; font-weight: 500;
          background: white; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s; appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239BAAB8' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 14px center;
          padding-right: 36px;
        }
        .sd-select:focus { border-color: #0D4F4F; box-shadow: 0 0 0 4px rgba(13,79,79,0.08); }

        /* ── Event meta bar ── */
        .sd-event-meta {
          display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
          padding: 14px 24px; background: rgba(13,79,79,0.03);
          border-bottom: 1.5px solid #F0F4F8;
          font-size: 13px; color: #7A8FA6; font-weight: 500;
        }
        .sd-event-meta-item { display: flex; align-items: center; gap: 6px; }
        .sd-event-meta-name {
          font-family: 'Playfair Display', serif;
          font-size: 15px; font-weight: 800; color: #0D1B1B; letter-spacing: -0.2px;
        }

        /* ── Search ── */
        .sd-search-wrap { position: relative; margin-bottom: 16px; }
        .sd-search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #9BAAB8; pointer-events: none; }
        .sd-search {
          width: 100%; padding: 13px 14px 13px 42px;
          border: 1.5px solid #E2EAF0; border-radius: 13px;
          font-size: 14px; font-family: inherit; color: #0D1B1B; font-weight: 500;
          background: white; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .sd-search:focus { border-color: #0D4F4F; box-shadow: 0 0 0 4px rgba(13,79,79,0.08); }

        /* ── Guest table ── */
        .sd-guest-card {
          background: white; border: 1.5px solid #E2EAF0; border-radius: 20px;
          overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 6px 20px rgba(0,0,0,0.05);
          animation: sdCardIn 0.5s 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }

        .sd-table-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 24px; border-bottom: 1.5px solid #F0F4F8;
        }
        .sd-table-title {
          font-family: 'Playfair Display', serif;
          font-size: 16px; font-weight: 800; color: #0D1B1B;
        }
        .sd-table-badge {
          font-size: 11px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.08); border: 1px solid rgba(13,79,79,0.12);
          padding: 3px 10px; border-radius: 20px;
        }

        .sd-table { width: 100%; border-collapse: collapse; font-size: 14px; }
        .sd-table thead { background: #F7F9FB; }
        .sd-table th {
          padding: 11px 20px; text-align: left;
          font-size: 11px; font-weight: 700; letter-spacing: 1px;
          color: #9BAAB8; text-transform: uppercase; border-bottom: 1.5px solid #F0F4F8;
        }
        .sd-table td { padding: 14px 20px; border-bottom: 1px solid #F7F9FB; vertical-align: middle; }
        .sd-table tr:last-child td { border-bottom: none; }
        .sd-table tbody tr { transition: background 0.12s; }
        .sd-table tbody tr:hover { background: #F7FAFA; }

        .sd-guest-name { font-weight: 700; color: #0D1B1B; }
        .sd-guest-phone { color: #9BAAB8; font-size: 12.5px; margin-top: 2px; }

        .sd-status-checked {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 700; color: #1A7A4A;
          background: rgba(26,122,74,0.08); border: 1px solid rgba(26,122,74,0.18);
          padding: 4px 10px; border-radius: 20px;
        }
        .sd-status-pending {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 12px; font-weight: 700; color: #9BAAB8;
          background: #F7F9FB; border: 1px solid #E2EAF0;
          padding: 4px 10px; border-radius: 20px;
        }

        /* ── Pagination ── */
        .sd-pagination {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 16px 24px; border-top: 1.5px solid #F0F4F8;
        }
        .sd-page-btn {
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 10px;
          border: 1.5px solid #E2EAF0; background: white; cursor: pointer;
          color: #4A6072; transition: border-color 0.15s, color 0.15s, background 0.15s;
        }
        .sd-page-btn:hover:not(:disabled) { border-color: #0D4F4F; color: #0D4F4F; background: rgba(13,79,79,0.04); }
        .sd-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .sd-page-label { font-size: 13px; font-weight: 600; color: #7A8FA6; padding: 0 4px; }

        /* ── Empty state ── */
        .sd-empty { padding: 48px 24px; text-align: center; }
        .sd-empty-icon {
          width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 14px;
          background: rgba(13,79,79,0.06); border: 1.5px solid rgba(13,79,79,0.1);
          display: flex; align-items: center; justify-content: center; color: #0D4F4F;
        }
        .sd-empty-title {
          font-family: 'Playfair Display', serif;
          font-size: 17px; font-weight: 800; color: #0D1B1B; margin-bottom: 5px;
        }
        .sd-empty-sub { font-size: 13.5px; color: #9BAAB8; }

        /* ── Modal overlay ── */
        .sd-modal-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.45);
          display: flex; align-items: center; justify-content: center;
          z-index: 50; padding: 20px;
          animation: sdOverlayIn 0.2s ease both;
        }
        @keyframes sdOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .sd-modal {
          background: white; border-radius: 24px; width: 100%; max-width: 480px;
          max-height: 90vh; overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 32px 64px rgba(0,0,0,0.12);
          animation: sdModalIn 0.35s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes sdModalIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .sd-modal-bar { height: 4px; background: linear-gradient(90deg, #0D4F4F, #E8A598); border-radius: 24px 24px 0 0; }

        .sd-modal-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 24px 16px; border-bottom: 1.5px solid #F0F4F8;
        }
        .sd-modal-title {
          font-family: 'Playfair Display', serif;
          font-size: 20px; font-weight: 900; color: #0D1B1B; letter-spacing: -0.3px;
        }
        .sd-modal-title span { color: #E8A598; }
        .sd-modal-close {
          width: 32px; height: 32px; border-radius: 50%; border: 1.5px solid #E2EAF0;
          background: white; cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: #9BAAB8; font-size: 18px; line-height: 1;
          transition: border-color 0.15s, color 0.15s;
        }
        .sd-modal-close:hover { border-color: #C0392B; color: #C0392B; }

        .sd-modal-body { padding: 20px 24px 24px; }

        /* Mode toggle */
        .sd-mode-toggle {
          display: flex; gap: 8px; margin-bottom: 20px;
          background: #F7F9FB; border-radius: 14px; padding: 5px;
        }
        .sd-mode-btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 7px;
          padding: 10px; border-radius: 10px; border: none; cursor: pointer;
          font-size: 13.5px; font-weight: 700; font-family: inherit;
          transition: background 0.2s, color 0.2s, box-shadow 0.2s;
          color: #7A8FA6; background: transparent;
        }
        .sd-mode-btn.active {
          background: white; color: #0D4F4F;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        }

        /* QR viewfinder */
        .sd-qr-wrap {
          border-radius: 16px; overflow: hidden; background: #0D1B1B;
          aspect-ratio: 4/3; position: relative;
        }
        .sd-qr-wrap video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }

        /* Scan corner decorations */
        .sd-qr-corners {
          position: absolute; inset: 0; pointer-events: none;
          display: flex; align-items: center; justify-content: center;
        }
        .sd-corner {
          position: absolute; width: 28px; height: 28px;
          border-color: #E8A598; border-style: solid; border-width: 0;
        }
        .sd-corner.tl { top: 16px; left: 16px; border-top-width: 3px; border-left-width: 3px; border-radius: 4px 0 0 0; }
        .sd-corner.tr { top: 16px; right: 16px; border-top-width: 3px; border-right-width: 3px; border-radius: 0 4px 0 0; }
        .sd-corner.bl { bottom: 16px; left: 16px; border-bottom-width: 3px; border-left-width: 3px; border-radius: 0 0 0 4px; }
        .sd-corner.br { bottom: 16px; right: 16px; border-bottom-width: 3px; border-right-width: 3px; border-radius: 0 0 4px 0; }

        .sd-qr-hint { text-align: center; font-size: 12.5px; color: #9BAAB8; margin-top: 10px; font-weight: 500; }

        /* Manual input */
        .sd-code-input {
          width: 100%; padding: 16px; text-align: center;
          font-size: 26px; letter-spacing: 6px; font-family: 'Courier New', monospace;
          font-weight: 700; color: #0D1B1B;
          border: 1.5px solid #E2EAF0; border-radius: 13px; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s;
          margin-bottom: 14px;
        }
        .sd-code-input:focus { border-color: #0D4F4F; box-shadow: 0 0 0 4px rgba(13,79,79,0.08); }

        .sd-submit-btn {
          width: 100%; padding: 14px; border: none; border-radius: 13px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 15px; font-weight: 700; font-family: inherit;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 14px rgba(13,79,79,0.32);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
        }
        .sd-submit-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(13,79,79,0.4); }
        .sd-submit-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        /* QR message */
        .sd-qr-msg {
          margin-top: 14px; padding: 12px 16px; border-radius: 12px;
          font-size: 13.5px; font-weight: 600; text-align: center;
        }
        .sd-qr-msg.success { background: rgba(26,122,74,0.08); border: 1px solid rgba(26,122,74,0.2); color: #1A7A4A; }
        .sd-qr-msg.error   { background: #FEF2F2; border: 1px solid #FECACA; color: #C0392B; }

        @media (max-width: 560px) {
          .sd-wrap { padding: 24px 16px 48px; }
          .sd-title { font-size: 26px; }
          .sd-table th, .sd-table td { padding: 11px 14px; }
          .sd-guest-phone { display: none; }
        }
      `}</style>

      <div className="sd-wrap">

        {/* ── Header ── */}
        <div className="sd-header">
          <div>
            <div className="sd-eyebrow"><div className="sd-eyebrow-dot" />Staff Portal</div>
            <h1 className="sd-title">Staff <span>Dashboard</span></h1>
            <p className="sd-subtitle">Manage guest arrivals for your event.</p>
          </div>
          <div className="sd-header-right">
            {selectedEventId && (
              <div className="sd-stat-pill">
                <Users size={15} />
                <strong>{checkedInCount}</strong> / {filteredGuests.length} checked in
              </div>
            )}
            <button className="sd-checkin-btn" onClick={() => setShowCheckinModal(true)}>
              <Camera size={15} /> Check‑in Guest
            </button>
          </div>
        </div>

        {/* ── Event selector card ── */}
        <div className="sd-card">
          <div className="sd-card-bar" />
          <div className="sd-card-body">
            <div className="sd-select-label">
              <Calendar size={13} /> Select Event
            </div>
            <select
              className="sd-select"
              value={selectedEventId}
              onChange={e => loadGuests(e.target.value)}
            >
              <option value="">— Choose an event —</option>
              {events.map(e => (
                <option key={e.id} value={e.id}>
                  {e.name} · {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Guest list ── */}
        {selectedEventId && (
          <>
            <div className="sd-search-wrap">
              <Search size={16} className="sd-search-icon" />
              <input
                type="text"
                className="sd-search"
                placeholder="Search by name or phone…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="sd-guest-card">
              {/* Event meta */}
              {selectedEvent && (
                <div className="sd-event-meta">
                  <span className="sd-event-meta-name">{selectedEvent.name}</span>
                  <span className="sd-event-meta-item">
                    <Calendar size={13} />
                    {new Date(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}

              <div className="sd-table-header">
                <div className="sd-table-title">Guest List</div>
                <div className="sd-table-badge">{filteredGuests.length} guest{filteredGuests.length !== 1 ? 's' : ''}</div>
              </div>

              {paginatedGuests.length === 0 ? (
                <div className="sd-empty">
                  <div className="sd-empty-icon"><Users size={22} /></div>
                  <div className="sd-empty-title">{searchTerm ? 'No results found' : 'No guests yet'}</div>
                  <p className="sd-empty-sub">{searchTerm ? 'Try a different name or phone number.' : 'Guests will appear here once added to this event.'}</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="sd-table">
                    <thead>
                      <tr>
                        <th>Guest</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedGuests.map(guest => (
                        <tr key={guest.id}>
                          <td>
                            <div className="sd-guest-name">{guest.name}</div>
                            {guest.phone && <div className="sd-guest-phone">{guest.phone}</div>}
                          </td>
                          <td>
                            {guest.checkedIn ? (
                              <span className="sd-status-checked">
                                <CheckCircle size={13} /> Checked in
                              </span>
                            ) : (
                              <span className="sd-status-pending">
                                <XCircle size={13} /> Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {totalPages > 1 && (
                <div className="sd-pagination">
                  <button className="sd-page-btn" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
                    <ChevronLeft size={16} />
                  </button>
                  <span className="sd-page-label">Page {currentPage} of {totalPages}</span>
                  <button className="sd-page-btn" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Check-in Modal ── */}
      {showCheckinModal && (
        <div className="sd-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowCheckinModal(false); }}>
          <div className="sd-modal">
            <div className="sd-modal-bar" />
            <div className="sd-modal-head">
              <div className="sd-modal-title">Guest <span>Check‑in</span></div>
              <button className="sd-modal-close" onClick={() => setShowCheckinModal(false)}>×</button>
            </div>
            <div className="sd-modal-body">

              {/* Mode toggle */}
              <div className="sd-mode-toggle">
                <button className={`sd-mode-btn ${checkinMode === 'qr' ? 'active' : ''}`} onClick={() => setCheckinMode('qr')}>
                  <QrCode size={15} /> QR Scanner
                </button>
                <button className={`sd-mode-btn ${checkinMode === 'manual' ? 'active' : ''}`} onClick={() => setCheckinMode('manual')}>
                  <Key size={15} /> Manual Code
                </button>
              </div>

              {checkinMode === 'qr' ? (
                <>
                  <div className="sd-qr-wrap">
                    <video ref={videoRef} playsInline />
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <div className="sd-qr-corners">
                      <div className="sd-corner tl" />
                      <div className="sd-corner tr" />
                      <div className="sd-corner bl" />
                      <div className="sd-corner br" />
                    </div>
                  </div>
                  <p className="sd-qr-hint">Position the guest's QR code within the frame</p>
                </>
              ) : (
                <form onSubmit={handleManualCheckin}>
                  <input
                    type="text"
                    className="sd-code-input"
                    value={manualCode}
                    onChange={e => setManualCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10))}
                    placeholder="e.g. 4D2ACD88"
                    maxLength={10}
                    required
                  />
                  <button type="submit" className="sd-submit-btn" disabled={manualCode.length < 6}>
                    <CheckCircle size={16} /> Check In
                  </button>
                </form>
              )}

              {qrMessage && (
                <div className={`sd-qr-msg ${qrMessage.includes('✅') ? 'success' : 'error'}`}>
                  {qrMessage}
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}