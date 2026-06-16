'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Calendar, MapPin, Users, QrCode, MessageCircle, Phone, ArrowRight, ArrowLeft, Upload, Plus, Palette, Send, Smartphone, CheckCircle, Trash2, CheckSquare, Square, ArrowUp } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

interface Guest {
  id: string;
  name: string;
  phone: string;
  routingChannel: string;
  checkedIn: boolean;
  attending: string;
}

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [eventId, setEventId] = useState<string | null>(null);
  const [event, setEvent] = useState<any>(null);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGuests, setSelectedGuests] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);

  // Resolve params and fetch data
  useEffect(() => {
    params.then(({ id }) => {
      setEventId(id);
      fetchData(id);
    });
  }, [params]);

  const fetchData = async (id: string) => {
    try {
      const res = await fetch(`/api/events/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load event');
      const data = await res.json();
      setEvent(data.event);
      setGuests(data.guests || []);
    } catch (err) {
      toast.error('Could not load event details');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedGuests.size === guests.length) {
      setSelectedGuests(new Set());
    } else {
      setSelectedGuests(new Set(guests.map(g => g.id)));
    }
  };

  const toggleSelectGuest = (id: string) => {
    const newSet = new Set(selectedGuests);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedGuests(newSet);
  };

  const deleteSelected = async () => {
    if (selectedGuests.size === 0) {
      toast.error('No guests selected');
      return;
    }
    if (!confirm(`Delete ${selectedGuests.size} selected guest${selectedGuests.size > 1 ? 's' : ''}? This action cannot be undone.`)) return;

    setDeleting(true);
    try {
      const guestIds = Array.from(selectedGuests);
      const res = await fetch('/api/guests/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Deleted ${data.count} guest${data.count > 1 ? 's' : ''}`);
        setSelectedGuests(new Set());
        fetchData(eventId!);
      } else {
        toast.error(data.error || 'Failed to delete guests');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(false);
    }
  };

  const deleteGuest = async (guestId: string) => {
    if (!confirm('Delete this guest?')) return;
    try {
      const res = await fetch(`/api/guests/${guestId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Guest deleted');
        setGuests(prev => prev.filter(g => g.id !== guestId));
        setSelectedGuests(prev => {
          const newSet = new Set(prev);
          newSet.delete(guestId);
          return newSet;
        });
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement;
    setShowBackToTop(target.scrollTop > 300);
  };

  const scrollToTop = () => {
    const container = document.getElementById('guest-list-container');
    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><div className="w-10 h-10 border-4 border-gray-200 border-t-[#0D4F4F] rounded-full animate-spin" /></div>;
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md text-center">
          <div className="text-5xl mb-3">🔍</div>
          <h1 className="font-serif text-2xl font-bold text-gray-800 mb-2">Event Not Found</h1>
          <p className="text-gray-500 text-sm mb-5">This event doesn't exist or you don't have access to it.</p>
          <Link href="/client/dashboard" className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white text-sm font-bold rounded-xl hover:shadow-md transition">
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const checkedInCount = guests.filter(g => g.checkedIn).length;
  const whatsappCount = guests.filter(g => g.routingChannel === 'whatsapp').length;
  const smsCount = guests.filter(g => g.routingChannel === 'sms').length;
  const attendingCount = guests.filter(g => g.attending === 'yes').length;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header with back link and delete event button */}
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/client/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] rounded-xl px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.14)]"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>
        <button
          onClick={async () => {
            if (!confirm('Delete this event and ALL its guests? This action cannot be undone.')) return;
            const res = await fetch(`/api/events/${eventId}`, { method: 'DELETE', credentials: 'include' });
            if (res.ok) {
              toast.success('Event deleted');
              router.push('/client/events');
            } else {
              const data = await res.json();
              toast.error(data.error || 'Failed to delete event');
            }
          }}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3.5 py-1.5 transition hover:bg-red-100"
        >
          <Trash2 size={14} /> Delete Event
        </button>
      </div>

      {/* Event header */}
      <div className="mb-7">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-serif text-3xl md:text-4xl font-black text-gray-900 leading-tight tracking-tight">{event.name}</h1>
          {event.commission_paid && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <CheckCircle size={12} /> Active
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-3 text-sm text-gray-500 mt-2">
          <div className="flex items-center gap-1.5">
            <Calendar size={16} className="text-[#0D4F4F]" />
            {format(new Date(event.date), 'PPP')}
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin size={16} className="text-[#0D4F4F]" />
            {event.venue}
          </div>
        </div>
        <p className="text-sm text-gray-400 mt-1">{event.address}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-7">
        <div className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition">
          <div className="w-9 h-9 rounded-xl bg-[rgba(13,79,79,0.08)] flex items-center justify-center mx-auto mb-2 text-[#0D4F4F]">
            <Users size={18} />
          </div>
          <div className="font-serif text-2xl font-black text-gray-800">{guests.length}</div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Total Guests</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition">
          <div className="w-9 h-9 rounded-xl bg-[#EDFAF4] flex items-center justify-center mx-auto mb-2 text-[#1A7A4A]">
            <Smartphone size={18} />
          </div>
          <div className="font-serif text-2xl font-black text-gray-800">{checkedInCount}</div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Checked In</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition">
          <div className="w-9 h-9 rounded-xl bg-[#EAF4F4] flex items-center justify-center mx-auto mb-2 text-[#0D4F4F]">
            <MessageCircle size={18} />
          </div>
          <div className="font-serif text-2xl font-black text-gray-800">{whatsappCount}</div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">WhatsApp</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center hover:shadow-md transition">
          <div className="w-9 h-9 rounded-xl bg-[#FEF6EC] flex items-center justify-center mx-auto mb-2 text-[#C07A20]">
            <Phone size={18} />
          </div>
          <div className="font-serif text-2xl font-black text-gray-800">{smsCount}</div>
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">SMS</div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-7">
        <Link href={`/client/invitations/send/${event.id}`} className="col-span-full bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white text-center py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition flex items-center justify-center gap-2">
          <Send size={15} /> Send Invitations
        </Link>
        <Link href={`/client/guests/import/${event.id}`} className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] text-center py-2.5 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2">
          <Upload size={14} /> Import Guests
        </Link>
        <Link href={`/client/guests/add/${event.id}`} className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] text-center py-2.5 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2">
          <Plus size={14} /> Add Guest
        </Link>
        <Link href={`/client/invitations/design/${event.id}`} className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] text-center py-2.5 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2">
          <Palette size={14} /> Design Card
        </Link>
        <Link href={`/client/check-in?event=${event.id}`} className="bg-[rgba(13,79,79,0.08)] text-[#0D4F4F] border border-[rgba(13,79,79,0.15)] text-center py-2.5 rounded-xl font-bold hover:bg-[rgba(13,79,79,0.15)] transition flex items-center justify-center gap-2">
          <QrCode size={14} /> Check-In
        </Link>
      </div>

      {/* Guest List with scroll, selection, and delete */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-lg font-extrabold text-gray-800">Guest List</h2>
            <span className="text-[11px] font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] px-2.5 py-1 rounded-full">
              {guests.length} guest{guests.length !== 1 ? 's' : ''}
            </span>
          </div>
          {guests.length > 0 && (
            <div className="flex items-center gap-3">
              <button onClick={toggleSelectAll} className="text-sm text-gray-600 hover:text-[#0D4F4F] flex items-center gap-1">
                {selectedGuests.size === guests.length ? <CheckSquare size={16} /> : <Square size={16} />}
                {selectedGuests.size === guests.length ? 'Deselect All' : 'Select All'}
              </button>
              {selectedGuests.size > 0 && (
                <button
                  onClick={deleteSelected}
                  disabled={deleting}
                  className="text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg transition disabled:opacity-50 flex items-center gap-1"
                >
                  {deleting ? <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" /> : <Trash2 size={14} />}
                  Delete ({selectedGuests.size})
                </button>
              )}
            </div>
          )}
        </div>

        {guests.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-4xl mb-3">👥</div>
            <h3 className="font-serif text-lg font-bold text-gray-800 mb-1">No guests yet</h3>
            <p className="text-sm text-gray-400">Import a guest list or add guests manually to get started.</p>
          </div>
        ) : (
          <>
            <div
              id="guest-list-container"
              className="divide-y divide-gray-100 max-h-96 overflow-y-auto scroll-smooth"
              onScroll={handleScroll}
            >
              {guests.map((guest) => (
                <div key={guest.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition">
                  <div className="flex items-center gap-3 flex-1">
                    <input
                      type="checkbox"
                      checked={selectedGuests.has(guest.id)}
                      onChange={() => toggleSelectGuest(guest.id)}
                      className="w-4 h-4 rounded border-gray-300 text-[#0D4F4F] focus:ring-[#0D4F4F]"
                    />
                    <div>
                      <p className="font-semibold text-gray-800">{guest.name}</p>
                      {guest.phone && <p className="text-xs text-gray-500">{guest.phone}</p>}
                      <div className="flex items-center gap-1 mt-1">
                        {guest.routingChannel === 'whatsapp' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.07)] px-2 py-0.5 rounded-full">
                            <MessageCircle size={10} /> WhatsApp
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                            <Phone size={10} /> SMS
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      {guest.checkedIn ? (
                        <span className="text-xs font-bold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">✓ Checked in</span>
                      ) : (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">Pending</span>
                      )}
                    </div>
                    <button
                      onClick={() => deleteGuest(guest.id)}
                      className="text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Back to Top button */}
            {showBackToTop && (
              <button
                onClick={scrollToTop}
                className="absolute bottom-4 right-4 bg-[#0D4F4F] text-white p-2 rounded-full shadow-lg hover:bg-[#0A3D3D] transition"
              >
                <ArrowUp size={20} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}