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
        fetchData(); // refresh
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
    if (guest.checkedIn) return { label: 'Checked In', icon: <CheckCircle size={16} className="text-green-600" /> };
    if (guest.invitationSentAt) return { label: 'Sent', icon: <Send size={16} className="text-blue-600" /> };
    return { label: 'Pending', icon: <Clock size={16} className="text-amber-600" /> };
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
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .inv-stat {
          background: white;
          border-radius: 16px;
          padding: 16px;
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

        .inv-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .inv-table th {
          text-align: left;
          padding: 14px 16px;
          background: #F7F9FB;
          font-weight: 600;
          color: #4A6072;
          border-bottom: 1.5px solid #EEF2F6;
        }
        .inv-table td {
          padding: 14px 16px;
          border-bottom: 1px solid #F7F9FB;
          vertical-align: middle;
        }
        .inv-table tr:hover td {
          background: #F9FCFE;
        }
        .inv-table .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          font-weight: 600;
          padding: 3px 8px;
          border-radius: 20px;
          background: #F0F4F8;
        }
        .inv-table .status-pending { background: #FFF3E0; color: #C07A20; }
        .inv-table .status-sent { background: #E3F2FD; color: #0D4F4F; }
        .inv-table .status-checked { background: #E8F5E9; color: #1A7A4A; }

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
          <table className="inv-table">
            <thead>
              <tr>
                <th>Guest</th>
                <th>Event</th>
                <th>Channel</th>
                <th>Sent Date</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {guests.map(g => {
                const status = getStatus(g);
                const statusClass = g.checkedIn ? 'status-checked' : (g.invitationSentAt ? 'status-sent' : 'status-pending');
                return (
                  <tr key={g.id}>
                    <td>
                      <div className="font-semibold">{g.name}</div>
                      <div className="text-xs text-gray-500">{g.phone}</div>
                    </td>
                    <td>
                      <div className="text-sm font-medium">{g.event.name}</div>
                      <div className="text-xs text-gray-400">{new Date(g.event.date).toLocaleDateString()}</div>
                    </td>
                    <td>
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
                    <td className="text-sm text-gray-500">
                      {g.invitationSentAt ? new Date(g.invitationSentAt).toLocaleString() : '—'}
                    </td>
                    <td>
                      <span className={`status-badge ${statusClass}`}>
                        {status.icon} {status.label}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {g.invitationSentAt ? (
                        <button
                          className="inv-resend-btn"
                          onClick={() => resendInvitation(g.id)}
                          disabled={resending === g.id}
                        >
                          {resending === g.id ? '...' : 'Resend'}
                        </button>
                      ) : (
                        <button
                          className="inv-resend-btn"
                          onClick={() => resendInvitation(g.id)}
                          disabled={resending === g.id}
                        >
                          {resending === g.id ? '...' : 'Send Now'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}