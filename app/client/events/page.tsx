'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, Plus, CheckCircle, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import DeleteEventButton from '@/components/DeleteEventButton';
import AppPageHeader from '@/components/ui/AppPageHeader';
import AppEmptyState from '@/components/ui/AppEmptyState';
import AppChip from '@/components/ui/AppChip';
import { AppSkeleton, AppSkeletonList } from '@/components/ui/AppSkeleton';
import { buttonClasses } from '@/components/ui/AppButton';
import { useReducedMotion } from '@/lib/motion';

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
  const reducedMotion = useReducedMotion();

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
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 space-y-3">
          <AppSkeleton className="h-3 w-20" />
          <AppSkeleton className="h-8 w-48" />
          <AppSkeleton className="h-4 w-72" />
        </div>
        <div className="bg-white rounded-card border border-gray-200/80 shadow-elev-1 overflow-hidden">
          <AppSkeletonList count={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* ─── Page Header ─── */}
      <AppPageHeader
        className="mb-6"
        eyebrow="Manage"
        title="Your Events"
        description="View and manage all your events in one place."
        actions={
          <Link href="/client/events/new" className={`${buttonClasses()} no-underline`}>
            <Plus size={16} />
            <span className="hidden sm:inline">New Event</span>
          </Link>
        }
      />

      {/* ─── Events Card ─── */}
      <div className="bg-white rounded-card border border-gray-200/80 shadow-elev-1 overflow-hidden animate-enter">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-gray-100">
          <h2 className="font-display text-base font-bold text-gray-800">All Events</h2>
          <AppChip tone="brand">
            {events.length} event{events.length !== 1 ? 's' : ''}
          </AppChip>
        </div>

        {events.length === 0 ? (
          <AppEmptyState
            icon={<Calendar className="w-7 h-7" />}
            title="No events yet"
            description="Create your first event and start managing guests and invitations."
            action={
              <Link href="/client/events/new" className={`${buttonClasses()} no-underline`}>
                <Plus size={15} /> Create your first event
              </Link>
            }
          />
        ) : (
          <ul>
            {events.map((event, idx) => {
              const d = new Date(event.date);
              const day = d.getDate();
              const mon = d.toLocaleString('default', { month: 'short' });
              return (
                <motion.li
                  key={event.id}
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reducedMotion ? 0 : idx * 0.04, duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50/70 transition-colors"
                >
                  <Link
                    href={`/client/events/${event.id}`}
                    className="flex items-center gap-2.5 sm:gap-4 flex-1 min-w-0 no-underline"
                  >
                    {/* Date tile */}
                    <span className="w-12 h-12 sm:w-14 sm:h-14 rounded-tap bg-brand text-white flex flex-col items-center justify-center shrink-0">
                      <span className="font-display text-lg sm:text-xl font-black leading-none">{day}</span>
                      <span className="text-[9px] font-bold uppercase opacity-75 mt-0.5">{mon}</span>
                    </span>

                    {/* Info */}
                    <span className="flex-1 min-w-0 block">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-[15px] font-bold text-gray-900 truncate">{event.name}</span>
                        {event.commission_paid && (
                          <AppChip tone="success" icon={<CheckCircle size={10} />}>Active</AppChip>
                        )}
                      </span>
                      <span className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                          <Calendar size={12} className="shrink-0" /> {d.toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400 font-medium min-w-0">
                          <MapPin size={12} className="shrink-0" /> <span className="truncate">{event.venue}</span>
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                          <Users size={12} className="shrink-0" /> {event._count.guests} guests
                        </span>
                      </span>
                    </span>

                    <ArrowRight size={16} className="text-gray-300 shrink-0" />
                  </Link>

                  <DeleteEventButton eventId={event.id} />
                </motion.li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
