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
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
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
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');

        .page-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 32px;
          gap: 16px;
          flex-wrap: wrap;
        }

        .page-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #0D4F4F;
          margin-bottom: 6px;
        }

        .page-title {
          font-family: 'Playfair Display', serif;
          font-size: 32px;
          font-weight: 900;
          color: #0D1B1B;
          line-height: 1.1;
          letter-spacing: -0.5px;
        }

        .page-title span { color: #E8A598; }

        .page-sub {
          color: #7A8FA6;
          font-size: 14px;
          margin-top: 6px;
          font-weight: 400;
        }

        .create-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white;
          font-size: 14px;
          font-weight: 700;
          border-radius: 14px;
          text-decoration: none;
          box-shadow: 0 4px 12px rgba(13, 79, 79, 0.3);
          transition: transform 0.15s, box-shadow 0.15s;
          white-space: nowrap;
        }
        .create-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(13, 79, 79, 0.35);
        }

        .section-card {
          background: white;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          animation: cardPop 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes cardPop {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 24px;
          border-bottom: 1.5px solid #F0F4F8;
        }

        .section-title {
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          font-weight: 800;
          color: #0D1B1B;
          letter-spacing: -0.2px;
        }

        .section-badge {
          font-size: 11px;
          font-weight: 700;
          color: #0D4F4F;
          background: rgba(13, 79, 79, 0.08);
          border: 1px solid rgba(13, 79, 79, 0.12);
          padding: 4px 12px;
          border-radius: 30px;
        }

        .event-row {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px 24px;
          text-decoration: none;
          border-bottom: 1px solid #F7F9FB;
          transition: background 0.15s;
          cursor: pointer;
        }
        .event-row:last-child { border-bottom: none; }
        .event-row:hover { background: #F7FAFA; }

        .event-date-box {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          color: white;
        }

        .event-date-day {
          font-size: 18px;
          font-weight: 800;
          line-height: 1;
          font-family: 'Playfair Display', serif;
        }

        .event-date-mon {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          opacity: 0.85;
          margin-top: 2px;
        }

        .event-info { flex: 1; min-width: 0; }

        .event-name {
          font-size: 15px;
          font-weight: 700;
          color: #0D1B1B;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .event-meta {
          font-size: 12px;
          color: #9BAAB8;
          margin-top: 4px;
          font-weight: 500;
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .active-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 8px;
          border-radius: 30px;
          font-size: 10px;
          font-weight: 700;
          background: #EDFAF4;
          color: #1A7A4A;
        }

        .event-arrow {
          color: #C8D4DE;
          flex-shrink: 0;
          transition: color 0.15s, transform 0.15s;
        }
        .event-row:hover .event-arrow {
          color: #0D4F4F;
          transform: translateX(3px);
        }

        .empty-state {
          padding: 64px 24px;
          text-align: center;
        }

        .empty-icon {
          width: 72px;
          height: 72px;
          border-radius: 24px;
          background: rgba(13, 79, 79, 0.07);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          font-size: 32px;
        }

        .empty-title {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 800;
          color: #0D1B1B;
          margin-bottom: 8px;
        }

        .empty-sub {
          font-size: 14px;
          color: #9BAAB8;
          line-height: 1.6;
        }

        .empty-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 24px;
          padding: 12px 24px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          border-radius: 14px;
          box-shadow: 0 4px 12px rgba(13, 79, 79, 0.3);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .empty-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(13, 79, 79, 0.35);
        }

        @media (max-width: 640px) {
          .page-title { font-size: 28px; }
          .create-btn span { display: none; }
          .create-btn { padding: 12px 16px; }
          .section-header { padding: 14px 20px; }
          .event-row { padding: 14px 20px; }
          .event-date-box { width: 42px; height: 42px; }
          .event-date-day { font-size: 16px; }
          .event-name { font-size: 14px; }
          .meta-item { font-size: 11px; }
        }
      `}</style>

      <div className="page-header">
        <div>
          <div className="page-eyebrow">Manage</div>
          <div className="page-title">
            Your <span>Events</span>
          </div>
          <p className="page-sub">View and manage all your events in one place.</p>
        </div>
        <Link href="/client/events/new" className="create-btn">
          <Plus size={16} />
          <span>New Event</span>
        </Link>
      </div>

      <div className="section-card">
        <div className="section-header">
          <div className="section-title">All Events</div>
          <div className="section-badge">{events.length} event{events.length !== 1 ? 's' : ''}</div>
        </div>

        {events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎊</div>
            <div className="empty-title">No events yet</div>
            <p className="empty-sub">Create your first event and start managing guests and invitations.</p>
            <Link href="/client/events/new" className="empty-btn">
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
                className="event-row"
                onClick={() => window.location.href = `/client/events/${event.id}`}
              >
                <div className="event-date-box">
                  <div className="event-date-day">{day}</div>
                  <div className="event-date-mon">{mon}</div>
                </div>
                <div className="event-info">
                  <div className="event-name">
                    {event.name}
                    {event.commission_paid && (
                      <span className="active-badge">
                        <CheckCircle size={10} /> Active
                      </span>
                    )}
                  </div>
                  <div className="event-meta">
                    <span className="meta-item"><Calendar size={12} /> {d.toLocaleDateString()}</span>
                    <span className="meta-item"><MapPin size={12} /> {event.venue}</span>
                    <span className="meta-item"><Users size={12} /> {event._count.guests} guests</span>
                  </div>
                </div>
                <DeleteEventButton eventId={event.id} />
                <ArrowRight size={16} className="event-arrow" />
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}