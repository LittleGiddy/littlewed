'use client';
import { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Search, CheckCircle, XCircle, Users, Loader2, CheckSquare, Square, Camera, Key } from 'lucide-react';
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
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [checkingIn, setCheckingIn] = useState(false);
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
        .then(setEvents)
        .catch(() => toast.error('Failed to load events'))
        .finally(() => setLoading(false));
    }
  }, [session, status, router]);

  const loadGuests = async (eventId: string) => {
    setSelectedEventId(eventId);
    setCurrentPage(1);
    setSearchTerm('');
    setSelectedGuests(new Set());
    const res = await fetch(`/api/events/${eventId}/guests`, { credentials: 'include' });
    const data = await res.json();
    setGuests(data);
    setFilteredGuests(data);
  };

  useEffect(() => {
    const filtered = guests.filter(g =>
      g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.phone.includes(searchTerm)
    );
    setFilteredGuests(filtered);
    setCurrentPage(1);
  }, [searchTerm, guests]);

  const toggleGuestSelection = (guestId: string) => {
    setSelectedGuests(prev => {
      const newSet = new Set(prev);
      if (newSet.has(guestId)) newSet.delete(guestId);
      else newSet.add(guestId);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const currentList = filteredGuests;
    const allSelected = currentList.length > 0 && currentList.every(g => selectedGuests.has(g.id));
    if (allSelected) {
      setSelectedGuests(prev => {
        const newSet = new Set(prev);
        currentList.forEach(g => newSet.delete(g.id));
        return newSet;
      });
    } else {
      setSelectedGuests(prev => {
        const newSet = new Set(prev);
        currentList.forEach(g => newSet.add(g.id));
        return newSet;
      });
    }
  };

  const bulkCheckIn = async () => {
    if (selectedGuests.size === 0) {
      toast.error('No guests selected');
      return;
    }
    setCheckingIn(true);
    let successCount = 0;
    for (const guestId of selectedGuests) {
      try {
        const res = await fetch(`/api/guests/${guestId}/checkin`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checkedIn: true }),
          credentials: 'include',
        });
        if (res.ok) successCount++;
      } catch (err) {
        console.error(err);
      }
    }
    await loadGuests(selectedEventId);
    toast.success(`Checked in ${successCount} guests`);
    setSelectedGuests(new Set());
    setCheckingIn(false);
  };

  const toggleCheckin = async (guestId: string, currentStatus: boolean) => {
    const res = await fetch(`/api/guests/${guestId}/checkin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkedIn: !currentStatus }),
      credentials: 'include',
    });
    if (res.ok) {
      loadGuests(selectedEventId);
      toast.success('Status updated');
    } else {
      toast.error('Failed to update');
    }
  };

  // QR Scanner logic
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
      } catch (err) {
        toast.error('Camera access denied or not available');
        setCheckinMode('manual');
      }
    };
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setScanning(false);
    };
  }, [showCheckinModal, checkinMode]);

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
      // Stop scanning and process token
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
    setQrMessage('Checking in...');
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
        loadGuests(selectedEventId);
        setTimeout(() => setShowCheckinModal(false), 1500);
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
    setQrMessage('Checking...');
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
        loadGuests(selectedEventId);
        setManualCode('');
        setTimeout(() => setShowCheckinModal(false), 1500);
      } else {
        toast.error(data.error);
        setQrMessage(`❌ ${data.error}`);
      }
    } catch {
      toast.error('Network error');
      setQrMessage('❌ Network error');
    }
  };

  if (loading) return <div className="p-4 text-center">Loading...</div>;
  if (!session || session.user?.role !== 'STAFF') return null;

  const totalPages = Math.ceil(filteredGuests.length / itemsPerPage);
  const paginatedGuests = filteredGuests.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const checkedInCount = filteredGuests.filter(g => g.checkedIn).length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6 flex justify-between items-center">
        <h1 className="font-serif text-3xl font-bold text-gray-900">Staff Dashboard</h1>
        <div className="flex gap-3">
          <div className="bg-white rounded-full shadow-sm px-4 py-1 flex items-center gap-2">
            <Users size={16} className="text-gray-500" />
            <span className="text-sm font-medium">Checked in: <span className="text-green-600 font-bold">{checkedInCount}</span> / {filteredGuests.length}</span>
          </div>
          <button
            onClick={() => setShowCheckinModal(true)}
            className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-semibold shadow-sm hover:bg-indigo-700 flex items-center gap-2"
          >
            <Camera size={16} /> Check‑in Guest
          </button>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Select Event</label>
        <select
          className="w-full p-2 border rounded-xl bg-white"
          value={selectedEventId}
          onChange={e => loadGuests(e.target.value)}
        >
          <option value="">-- Choose event --</option>
          {events.map(e => (
            <option key={e.id} value={e.id}>{e.name} ({new Date(e.date).toLocaleDateString()})</option>
          ))}
        </select>
      </div>

      {selectedEventId && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or phone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-xl bg-white"
              />
            </div>
            {filteredGuests.length > 0 && (
              <div className="flex gap-2">
                <button onClick={toggleSelectAll} className="px-3 py-2 border rounded-xl text-sm flex items-center gap-1">
                  {filteredGuests.every(g => selectedGuests.has(g.id)) ? <CheckSquare size={16} /> : <Square size={16} />}
                  Select All
                </button>
                <button
                  onClick={bulkCheckIn}
                  disabled={checkingIn || selectedGuests.size === 0}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold shadow-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {checkingIn ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  Check In Selected ({selectedGuests.size})
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-3 text-left w-8"><input type="checkbox" checked={filteredGuests.length > 0 && filteredGuests.every(g => selectedGuests.has(g.id))} onChange={toggleSelectAll} className="rounded" /></th>
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Phone</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedGuests.map(guest => (
                    <tr key={guest.id} className="hover:bg-gray-50">
                      <td className="p-3"><input type="checkbox" checked={selectedGuests.has(guest.id)} onChange={() => toggleGuestSelection(guest.id)} className="rounded" /></td>
                      <td className="p-3 font-medium">{guest.name}</td>
                      <td className="p-3">{guest.phone}</td>
                      <td className="p-3">
                        {guest.checkedIn ? (
                          <span className="inline-flex items-center gap-1 text-green-600"><CheckCircle size={14} /> Checked in</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400"><XCircle size={14} /> Pending</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => toggleCheckin(guest.id, guest.checkedIn)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition ${guest.checkedIn ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                        >
                          {guest.checkedIn ? 'Undo' : 'Check In'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 border rounded disabled:opacity-50">Previous</button>
              <span className="px-3 py-1">Page {currentPage} of {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
            </div>
          )}
        </>
      )}

      {/* Check‑in Modal */}
      {showCheckinModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-serif text-xl font-extrabold text-gray-800">Guest Check‑in</h2>
              <button onClick={() => setShowCheckinModal(false)} className="text-gray-500 hover:text-gray-700 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6">
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setCheckinMode('qr')}
                  className={`flex-1 py-2 rounded-xl font-semibold transition ${checkinMode === 'qr' ? 'bg-[#0D4F4F] text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  <Camera size={16} className="inline mr-1" /> QR Scanner
                </button>
                <button
                  onClick={() => setCheckinMode('manual')}
                  className={`flex-1 py-2 rounded-xl font-semibold transition ${checkinMode === 'manual' ? 'bg-[#0D4F4F] text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  <Key size={16} className="inline mr-1" /> Manual Code
                </button>
              </div>

              {checkinMode === 'qr' ? (
                <div>
                  <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                    <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" />
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                  {qrMessage && <p className="text-center text-sm mt-2">{qrMessage}</p>}
                </div>
              ) : (
                <form onSubmit={handleManualCheckin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">6‑digit code</label>
                    <input
                      type="text"
                      value={manualCode}
                      onChange={e => setManualCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="w-full p-3 text-center text-2xl tracking-widest font-mono border rounded-lg focus:ring-2 focus:ring-[#0D4F4F]"
                      placeholder="000000"
                      maxLength={6}
                      required
                    />
                  </div>
                  {qrMessage && <p className="text-center text-sm">{qrMessage}</p>}
                  <button
                    type="submit"
                    disabled={manualCode.length !== 6}
                    className="w-full bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white py-2 rounded-xl font-bold shadow-md hover:shadow-lg disabled:opacity-50 transition"
                  >
                    Check In
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}