'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, MapPin, Users, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  _count: { guests: number };
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/events')
      .then(res => res.json())
      .then(data => { setEvents(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">My Events</h1>
        <Link href="/client/events/new" className="bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 transition">
          <Plus className="w-5 h-5" />
        </Link>
      </div>
      <div className="space-y-4">
        {events.map((event, idx) => (
          <motion.div
            key={event.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md border border-gray-100 p-5 hover:shadow-lg transition cursor-pointer"
            onClick={() => window.location.href = `/client/events/${event.id}`}
          >
            <h2 className="text-lg font-semibold">{event.name}</h2>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
              <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {format(new Date(event.date), 'PPP')}</span>
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {event.venue}</span>
              <span className="flex items-center gap-1"><Users className="w-4 h-4" /> {event._count.guests} guests</span>
            </div>
          </motion.div>
        ))}
        {events.length === 0 && <div className="text-center py-12 text-gray-500">No events yet. Tap the + button to create one.</div>}
      </div>
    </div>
  );
}