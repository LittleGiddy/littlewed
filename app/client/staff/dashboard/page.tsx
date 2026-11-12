'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Loader2, Lock, PartyPopper } from 'lucide-react';
import toast from 'react-hot-toast';
import CheckInView from '@/app/client/check-in/CheckInView';

interface Event {
  id: string;
  name: string;
  date: string;
  venue?: string | null;
}

/**
 * The staff check-in station uses the exact same CheckInView as the tenant
 * station, so the two can never drift apart again. The only staff-specific
 * surface is the event picker, because staff only see the events the tenant
 * granted them.
 */
export default function StaffDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (status === 'authenticated' && session?.user?.role !== 'STAFF') router.push('/login');
    if (!session) return;

    fetch('/api/events', { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setEvents(data);
      })
      .catch(() => toast.error('Failed to load events'))
      .finally(() => setLoading(false));
  }, [session, status, router]);

  const selectedEvent = events.find((event) => event.id === selectedEventId);

  const eventInfo = useMemo(() => {
    if (!selectedEvent) return undefined;
    return {
      name: selectedEvent.name,
      venue: selectedEvent.venue || '',
      date: new Date(selectedEvent.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    };
  }, [selectedEvent]);

  if (loading || status === 'loading') {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-brand" />
      </div>
    );
  }
  if (!session || session.user?.role !== 'STAFF') return null;

  if (events.length === 0) {
    return (
      <div className="mx-auto w-full max-w-lg px-1 py-12 text-center">
        <Lock size={36} className="mx-auto mb-2 text-gray-300" />
        <p className="font-medium text-gray-600">No events assigned yet</p>
        <p className="text-sm text-gray-400 mt-1 max-w-[280px] mx-auto">
          Your event organiser hasn&apos;t granted you access to an event. Check back once check-in
          opens.
        </p>
        <Link
          href="/client/staff/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-brand bg-white border border-brand/20 rounded-tap px-3 py-1.5 transition hover:bg-brand/10 mt-4"
        >
          <ArrowLeft size={14} /> Back
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 pb-2">
      <div className="rounded-card border border-gray-200 bg-white p-3 shadow-sm">
        <label className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide uppercase text-brand mb-1.5">
          <Calendar size={13} /> Select Event
        </label>
        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-tap text-sm focus:ring-2 focus:ring-brand/20 focus:border-brand outline-none bg-white"
        >
          <option value="">- Choose an event -</option>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.name} ·{' '}
              {new Date(event.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </option>
          ))}
        </select>
      </div>

      {selectedEventId ? (
        <CheckInView
          key={selectedEventId}
          eventId={selectedEventId}
          backHref={null}
          eventInfo={eventInfo}
        />
      ) : (
        <div className="text-center py-12 text-gray-500">
          <PartyPopper size={36} className="mx-auto mb-2 text-gray-300" />
          <p className="font-medium">Select an event to start checking in guests</p>
        </div>
      )}
    </div>
  );
}
