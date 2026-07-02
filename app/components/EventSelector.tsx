'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Event {
  id: string;
  name: string;
  date: string;
  _count: { guests: number };
}

interface EventSelectorProps {
  title: string;
  description: string;
  backUrl: string;
  actionLabel: string;
  actionBase: string; // e.g., '/client/guests/import'
}

export default function EventSelector({
  title,
  description,
  backUrl,
  actionLabel,
  actionBase,
}: EventSelectorProps) {
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
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#0D4F4F]" />
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="text-5xl mb-4">📅</div>
        <h2 className="font-serif text-2xl font-bold text-gray-800 mb-2">No events yet</h2>
        <p className="text-gray-500">Create an event first before {actionLabel.toLowerCase()}.</p>
        <Link
          href="/client/events/new"
          className="inline-block mt-4 bg-[#0D4F4F] text-white px-6 py-2 rounded-xl font-semibold hover:bg-[#0A3D3D] transition"
        >
          Create Event
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
      <Link
        href={backUrl}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] border border-[rgba(13,79,79,0.12)] rounded-xl px-3.5 py-1.5 transition hover:bg-[rgba(13,79,79,0.14)] mb-6"
      >
        ← Back
      </Link>

      <h1 className="font-serif text-3xl font-black text-gray-900 mb-2">{title}</h1>
      <p className="text-gray-500 mb-6">{description}</p>

      <div className="space-y-3">
        {events.map((event) => {
          const d = new Date(event.date);
          const day = d.getDate();
          const mon = d.toLocaleString('default', { month: 'short' });
          return (
            <Link
              key={event.id}
              href={`${actionBase}/${event.id}`}
              className="block bg-white border border-gray-200 rounded-xl p-4 hover:border-[#0D4F4F] hover:shadow-md transition group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#0D4F4F] text-white flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-lg font-bold leading-none">{day}</span>
                    <span className="text-[10px] font-semibold uppercase opacity-80">{mon}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-gray-800">{event.name}</div>
                    <div className="text-sm text-gray-500">{event._count.guests} guests</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[#0D4F4F] font-medium">
                  {actionLabel}
                  <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}