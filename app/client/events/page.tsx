'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, Plus, CheckCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import DeleteEventButton from '@/components/DeleteEventButton';

interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  commission_paid: boolean;
  _count: { guests: number };
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/events', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        setEvents(data);
        setLoading(false);
      })
      .catch(() => {
        toast.error('Failed to load events');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="h-3 w-20 bg-gray-200 rounded mb-2 animate-pulse" />
            <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl shadow-sm p-5 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-gray-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* ─── Page Header ─── */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-[11px] font-bold tracking-[1.5px] text-[#0D4B4B] uppercase mb-1.5">Manage</p>
          <h1 className="font-serif text-3xl sm:text-[32px] font-black text-gray-900 leading-tight tracking-tight">
            Your <span className="text-[#FF6B5C]">Events</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1.5">View and manage all your events in one place.</p>
        </div>
        <Link
          href="/client/events/new"
          className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-br from-[#0D4B4B] to-[#0A3939] text-white text-sm font-bold rounded-[14px] shadow-md shadow-[#0D4B4B]/25 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#0D4B4B]/30 whitespace-nowrap"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Event</span>
        </Link>
      </div>

      {/* ─── Events Card ─── */}
      <div className="bg-white rounded-3xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.05)] animate-[cardIn_0.5s_cubic-bezier(0.16,1,0.3,1)_both]">
        <style>{`
          @keyframes cardIn {
            from { opacity: 0; transform: translateY(12px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>

        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100">
          <h2 className="font-serif text-lg font-extrabold text-gray-800">All Events</h2>
          <span className="text-[11px] font-bold text-[#0D4B4B] bg-[#0D4B4B]/5 border border-[#0D4B4B]/10 px-3 py-1 rounded-full">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </span>
        </div>

        {events.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <div className="w-[72px] h-[72px] rounded-[24px] bg-[#0D4B4B]/5 flex items-center justify-center mx-auto mb-5">
              <span className="text-4xl">🎊</span>
            </div>
            <h3 className="font-serif text-xl font-extrabold text-gray-900 mb-2">No events yet</h3>
            <p className="text-sm text-gray-400">Create your first event and start managing guests and invitations.</p>
            <Link
              href="/client/events/new"
              className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-gradient-to-br from-[#0D4B4B] to-[#0A3939] text-white text-sm font-bold rounded-[14px] shadow-md shadow-[#0D4B4B]/25 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <Plus size={15} /> Create your first event
            </Link>
          </div>
        ) : (
          events.map((event, idx) => {
            const d = new Date(event.date);
            const day = d.getDate();
            const mon = d.toLocaleString('default', { month: 'short' });
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="flex items-center gap-2.5 sm:gap-4 px-4 sm:px-6 py-4 border-b border-gray-50 last:border-b-0 hover:bg-gray-50/60 transition-colors cursor-pointer"
                onClick={() => window.location.href = `/client/events/${event.id}`}
              >
                {/* Date Box */}
                <div className="w-12 h-12 sm:w-[48px] sm:h-[48px] rounded-[14px] bg-gradient-to-br from-[#0D4B4B] to-[#0A3939] flex flex-col items-center justify-center shrink-0 text-white">
                  <span className="font-serif text-lg sm:text-[18px] font-bold leading-none">{day}</span>
                  <span className="text-[9px] font-bold uppercase opacity-80 mt-0.5">{mon}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[15px] font-bold text-gray-900 truncate">{event.name}</span>
                    {event.commission_paid && (
                      <span className="inline-flex items-center gap-1 px-2 py-[2px] rounded-full text-[10px] font-bold bg-green-50 text-green-700">
                        <CheckCircle size={10} /> Active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                      <Calendar size={12} /> {d.toLocaleDateString()}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                      <MapPin size={12} /> {event.venue}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                      <Users size={12} /> {event._count.guests} guests
                    </span>
                  </div>
                </div>

                <DeleteEventButton eventId={event.id} />
                <ArrowRight size={16} className="text-gray-300 shrink-0 transition-colors group-hover:text-[#0D4B4B]" />
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}
