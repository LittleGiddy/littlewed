'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Filter, ChevronDown, RefreshCw, MessageCircle, Phone, CheckCircle, Clock, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Guest {
  id: string;
  name: string;
  phone: string;
  routingChannel: string;
  invitationSentAt: string | null;
  checkedIn: boolean;
  event: {
    id: string;
    name: string;
    date: string;
  };
}

interface Event {
  id: string;
  name: string;
}

export default function InvitationsPage() {
  const router = useRouter();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEvent, setFilterEvent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [resending, setResending] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [guestsRes, eventsRes] = await Promise.all([
        fetch(`/api/invitations?eventId=${filterEvent}&status=${filterStatus}&channel=${filterChannel}`, {
          credentials: 'include',
        }),
        fetch('/api/events', { credentials: 'include' }),
      ]);
      const guestsData = await guestsRes.json();
      const eventsData = await eventsRes.json();
      setGuests(guestsData);
      setEvents(eventsData);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterEvent, filterStatus, filterChannel]);

  const resendInvitation = async (guestId: string) => {
    if (!confirm('Resend invitation to this guest?')) return;
    setResending(guestId);
    try {
      const res = await fetch('/api/invitations/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId }),
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Invitation resent');
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to resend');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setResending(null);
    }
  };

  const getStatus = (guest: Guest) => {
    if (guest.checkedIn) return { label: 'Checked In', icon: <CheckCircle size={16} className="text-[#1A7A4A]" /> };
    if (guest.invitationSentAt) return { label: 'Sent', icon: <Send size={16} className="text-[#0D4F4F]" /> };
    return { label: 'Pending', icon: <Clock size={16} className="text-[#C07A20]" /> };
  };

  const stats = {
    total: guests.length,
    pending: guests.filter(g => !g.invitationSentAt).length,
    sent: guests.filter(g => g.invitationSentAt && !g.checkedIn).length,
    checkedIn: guests.filter(g => g.checkedIn).length,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');

        .inv-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 32px;
          gap: 16px;
          flex-wrap: wrap;
        }

        .inv-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #0D4F4F;
          margin-bottom: 6px;
        }

        .inv-title {
          font-family: 'Playfair Display', serif;
          font-size: 32px;
          font-weight: 900;
          color: #0D1B1B;
          line-height: 1.1;
          letter-spacing: -0.5px;
        }

        .inv-title span { color: #E8A598; }

        .inv-sub {
          color: #7A8FA6;
          font-size: 14px;
          margin-top: 6px;
          font-weight: 400;
        }

        .inv-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 32px;
        }

        .inv-stat {
          background: white;
          border-radius: 16px;
          padding: 16px 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          text-align: center;
        }
        .inv-stat-value {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 900;
          color: #0D1B1B;
        }
        .inv-stat-label {
          font-size: 12px;
          color: #9BAAB8;
          font-weight: 600;
          margin-top: 4px;
        }

        .inv-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .inv-filter-select {
          padding: 8px 12px;
          border: 1.5px solid #E2EAF0;
          border-radius: 10px;
          font-size: 13px;
          font-family: inherit;
          background: white;
          outline: none;
          transition: border-color 0.15s;
        }
        .inv-filter-select:focus {
          border-color: #0D4F4F;
        }

        .inv-refresh-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: 1.5px solid #E2EAF0;
          border-radius: 10px;
          background: white;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
        }
        .inv-refresh-btn:hover {
          border-color: #0D4F4F;
          color: #0D4F4F;
        }

        .inv-table-wrap {
          background: white;
          border-radius: 20px;
          border: 1.5px solid #E2EAF0;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }

        .inv-resend-btn {
          background: none;
          border: 1.5px solid #E2EAF0;
          border-radius: 8px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          color: #0D4F4F;
          transition: background 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .inv-resend-btn:hover {
          background: rgba(13,79,79,0.06);
          border-color: #0D4F4F;
        }
        .inv-resend-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .inv-empty {
          padding: 48px 24px;
          text-align: center;
          color: #9BAAB8;
        }

        .inv-empty-icon {
          font-size: 40px;
          margin-bottom: 12px;
        }

        /* Card view (mobile) */
        .guest-card {
          background: white;
          border-radius: 12px;
          padding: 14px 16px;
          border: 1px solid #E2EAF0;
          margin-bottom: 10px;
          transition: border-color 0.15s;
        }
        .guest-card:hover {
          border-color: #0D4F4F;
        }
        .guest-card .top-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .guest-card .guest-name {
          font-weight: 700;
          color: #0D1B1B;
          font-size: 15px;
        }
        .guest-card .guest-phone {
          font-size: 12px;
          color: #9BAAB8;
          font-family: monospace;
        }
        .guest-card .event-name {
          font-size: 13px;
          font-weight: 500;
          color: #4A6072;
        }
        .guest-card .event-date {
          font-size: 11px;
          color: #9BAAB8;
        }
        .guest-card .channel-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 20px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .guest-card .channel-whatsapp {
          background: rgba(13,79,79,0.08);
          color: #0D4F4F;
        }
        .guest-card .channel-sms {
          background: #F0F4F8;
          color: #4A6072;
        }
        .guest-card .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 20px;
        }
        .guest-card .status-pending { background: #FFF3E0; color: #C07A20; }
        .guest-card .status-sent { background: #E3F2FD; color: #0D4F4F; }
        .guest-card .status-checked { background: #E8F5E9; color: #1A7A4A; }
        .guest-card .sent-date {
          font-size: 11px;
          color: #9BAAB8;
        }
        .guest-card .action-btn {
          background: none;
          border: 1.5px solid #E2EAF0;
          border-radius: 8px;
          padding: 4px 12px;
          font-size: 12px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          color: #0D4F4F;
          transition: background 0.15s, border-color 0.15s;
          white-space: nowrap;
        }
        .guest-card .action-btn:hover {
          background: rgba(13,79,79,0.06);
          border-color: #0D4F4F;
        }
        .guest-card .action-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 640px) {
          .inv-title { font-size: 28px; }
          .inv-stats { grid-template-columns: repeat(2, 1fr); }
          .inv-filter-select { flex: 1; min-width: 120px; }
        }
      `}</style>

      <div className="inv-header">
        <div>
          <div className="inv-eyebrow">Communications</div>
          <h1 className="inv-title">Invitations</h1>
          <p className="inv-sub">Track all invitations sent across your events.</p>
        </div>
        <button className="inv-refresh-btn" onClick={fetchData}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="inv-stats">
        <div className="inv-stat">
          <div className="inv-stat-value">{stats.total}</div>
          <div className="inv-stat-label">Total Guests</div>
        </div>
        <div className="inv-stat">
          <div className="inv-stat-value">{stats.pending}</div>
          <div className="inv-stat-label">Pending</div>
        </div>
        <div className="inv-stat">
          <div className="inv-stat-value">{stats.sent}</div>
          <div className="inv-stat-label">Sent</div>
        </div>
        <div className="inv-stat">
          <div className="inv-stat-value">{stats.checkedIn}</div>
          <div className="inv-stat-label">Checked In</div>
        </div>
      </div>

      <div className="inv-filters">
        <select className="inv-filter-select" value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
          <option value="">All Events</option>
          {events.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <select className="inv-filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="checked_in">Checked In</option>
        </select>
        <select className="inv-filter-select" value={filterChannel} onChange={e => setFilterChannel(e.target.value)}>
          <option value="">All Channels</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
        </select>
      </div>

      <div className="inv-table-wrap">
        {loading ? (
          <div className="p-6 text-center">Loading...</div>
        ) : guests.length === 0 ? (
          <div className="inv-empty">
            <div className="inv-empty-icon">📨</div>
            <p className="font-semibold text-gray-700">No invitations found</p>
            <p className="text-sm">Send invitations from an event to see them here.</p>
          </div>
        ) : (
          <>
            {/* Mobile card view */}
            <div className="sm:hidden p-3 max-h-[500px] overflow-y-auto">
              {guests.map(g => {
                const status = getStatus(g);
                const statusClass = g.checkedIn ? 'status-checked' : (g.invitationSentAt ? 'status-sent' : 'status-pending');
                const channelClass = g.routingChannel === 'whatsapp' ? 'channel-whatsapp' : 'channel-sms';
                return (
                  <div key={g.id} className="guest-card">
                    <div className="top-row">
                      <div>
                        <div className="guest-name">{g.name}</div>
                        <div className="guest-phone">{g.phone}</div>
                      </div>
                      <button
                        className="action-btn"
                        onClick={() => resendInvitation(g.id)}
                        disabled={resending === g.id}
                      >
                        {resending === g.id ? '...' : (g.invitationSentAt ? 'Resend' : 'Send Now')}
                      </button>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`channel-badge ${channelClass}`}>
                        {g.routingChannel === 'whatsapp' ? <MessageCircle size={12} /> : <Phone size={12} />}
                        {g.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
                      </span>
                      <span className={`status-badge ${statusClass}`}>
                        {status.icon} {status.label}
                      </span>
                      <span className="sent-date">
                        {g.invitationSentAt ? new Date(g.invitationSentAt).toLocaleString() : 'Not sent'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      <span className="event-name">{g.event.name}</span>
                      <span className="event-date ml-2">{new Date(g.event.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table view */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left whitespace-nowrap">Guest</th>
                    <th className="px-4 py-2 text-left whitespace-nowrap">Event</th>
                    <th className="px-4 py-2 text-left whitespace-nowrap">Channel</th>
                    <th className="px-4 py-2 text-left whitespace-nowrap">Sent Date</th>
                    <th className="px-4 py-2 text-left whitespace-nowrap">Status</th>
                    <th className="px-4 py-2 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {guests.map(g => {
                    const status = getStatus(g);
                    const statusClass = g.checkedIn ? 'status-checked' : (g.invitationSentAt ? 'status-sent' : 'status-pending');
                    return (
                      <tr key={g.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          <div className="font-semibold">{g.name}</div>
                          <div className="text-xs text-gray-500 font-mono">{g.phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium">{g.event.name}</div>
                          <div className="text-xs text-gray-400">{new Date(g.event.date).toLocaleDateString()}</div>
                        </td>
                        <td className="px-4 py-3">
                          {g.routingChannel === 'whatsapp' ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#0D4F4F] bg-[rgba(13,79,79,0.08)] px-2 py-0.5 rounded-full">
                              <MessageCircle size={12} /> WhatsApp
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                              <Phone size={12} /> SMS
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {g.invitationSentAt ? new Date(g.invitationSentAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusClass === 'status-checked' ? 'bg-green-50 text-green-700' : statusClass === 'status-sent' ? 'bg-blue-50 text-[#0D4F4F]' : 'bg-amber-50 text-amber-700'}`}>
                            {status.icon} {status.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            className="inv-resend-btn"
                            onClick={() => resendInvitation(g.id)}
                            disabled={resending === g.id}
                          >
                            {resending === g.id ? '...' : (g.invitationSentAt ? 'Resend' : 'Send Now')}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}