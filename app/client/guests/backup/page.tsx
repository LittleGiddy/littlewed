'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Users, Search, Download, Share2, ArrowLeft, Loader2, 
  CheckCircle, Clock, MessageCircle, Phone, FileSpreadsheet, 
  Copy, Check, Filter
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Guest {
  id: string;
  name: string;
  phone: string;
  routingChannel: string;
  checkedIn: boolean;
  eventId: string;
  event?: { name: string };
}

export default function BackupGuestsPage() {
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  useEffect(() => {
    fetchGuests();
  }, []);

  const fetchGuests = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/guests/all', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setGuests(data.guests || []);
      } else {
        toast.error('Failed to load guests');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return guests;
    const term = search.trim().toLowerCase();
    return guests.filter(g =>
      g.name.toLowerCase().includes(term) ||
      (g.phone && g.phone.includes(term)) ||
      (g.event?.name?.toLowerCase().includes(term))
    );
  }, [guests, search]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ─── Export CSV ──────────────────────────────────────────────────
  const exportCSV = () => {
    const headers = ['Name', 'Phone', 'Channel', 'Checked In', 'Event'];
    const rows = filtered.map(g => [
      g.name,
      g.phone || '',
      g.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS',
      g.checkedIn ? 'Yes' : 'No',
      g.event?.name || 'Unknown',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guests-backup-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} guests`);
  };

  // ─── Share (native share sheet or copy link) ──────────────────
  const sharePage = async () => {
    const url = window.location.href;
    const shareData = {
      title: 'Guest Database',
      text: 'Check out the guest database for all events.',
      url: url,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        toast.success('Shared successfully!');
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          toast.error('Share cancelled or failed');
        }
      }
    } else {
      // Fallback: copy link to clipboard
      try {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied to clipboard!');
      } catch {
        toast.error('Failed to copy link');
      }
    }
  };

  // ─── Render ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 size={32} className="animate-spin text-[#0D4F4F]" />
        <p className="text-sm text-gray-400">Loading all guests…</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <Link href="/client/dashboard" className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] rounded-xl px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.14)]">
            <ArrowLeft size={14} /> Dashboard
          </Link>
          <h1 className="font-serif text-3xl font-black text-gray-900 mt-3">Guest Database</h1>
          <p className="text-sm text-gray-500">All guests across all events – {guests.length} total</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 bg-[#0D4F4F] text-white px-4 py-2 rounded-xl font-semibold hover:bg-[#0A3D3D] transition disabled:opacity-50"
          >
            <Download size={16} /> Export CSV
          </button>
          <button
            onClick={sharePage}
            className="inline-flex items-center gap-1.5 bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-semibold hover:bg-gray-200 transition"
          >
            <Share2 size={16} /> Share
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="Search by name, phone, or event…"
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent text-sm"
        />
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-4 text-sm text-gray-500 mb-4">
        <span className="bg-gray-100 px-3 py-1 rounded-full">Total: {guests.length}</span>
        <span className="bg-green-50 text-green-700 px-3 py-1 rounded-full flex items-center gap-1">
          <CheckCircle size={14} /> Checked In: {guests.filter(g => g.checkedIn).length}
        </span>
        <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full flex items-center gap-1">
          <Clock size={14} /> Pending: {guests.filter(g => !g.checkedIn).length}
        </span>
        {search && <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full">Filtered: {filtered.length}</span>}
      </div>

      {/* Guest Cards */}
      {paginated.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Users size={48} className="mx-auto mb-3 opacity-30" />
          <p>No guests found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {paginated.map(guest => (
            <div key={guest.id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{guest.name}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span className="truncate">{guest.phone || 'No phone'}</span>
                    <span>•</span>
                    <span className={`inline-flex items-center gap-1 ${guest.checkedIn ? 'text-green-600' : 'text-amber-600'}`}>
                      {guest.checkedIn ? <CheckCircle size={12} /> : <Clock size={12} />}
                      {guest.checkedIn ? 'Checked in' : 'Pending'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {guest.routingChannel === 'whatsapp' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] px-2 py-0.5 rounded-full">
                        <MessageCircle size={10} /> WhatsApp
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                        <Phone size={10} /> SMS
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full truncate max-w-24">
                      {guest.event?.name || 'Unknown event'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
          <span className="text-sm text-gray-400">
            Showing {((currentPage - 1) * pageSize) + 1} – {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
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
    </div>
  );
}