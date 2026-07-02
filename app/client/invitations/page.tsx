'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, RefreshCw, MessageCircle, Phone, CheckCircle, Clock, XCircle, Trash2, Edit2, Check, X, Square, CheckSquare } from 'lucide-react';
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

export default function GuestsPage() {
  const router = useRouter();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEvent, setFilterEvent] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [resending, setResending] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ id: string; field: 'name' | 'phone' } | null>(null);
  const [editValue, setEditValue] = useState('');

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
      setSelected(new Set());
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filterEvent, filterStatus, filterChannel]);

  const toggleSelect = (id: string) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelected(newSet);
  };

  const toggleSelectAll = () => {
    if (selected.size === guests.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(guests.map(g => g.id)));
    }
  };

  const bulkSend = async () => {
    if (selected.size === 0) {
      toast.error('Select at least one guest');
      return;
    }
    const ids = Array.from(selected);
    if (!confirm(`Send invitations to ${ids.length} selected guest${ids.length > 1 ? 's' : ''}?`)) return;

    setResending(new Set(ids));
    let success = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        const res = await fetch('/api/invitations/send-whatsapp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guestId: id }),
          credentials: 'include',
        });
        if (res.ok) success++;
        else failed++;
      } catch {
        failed++;
      }
    }
    toast.success(`Sent to ${success} guest${success > 1 ? 's' : ''}${failed > 0 ? `, ${failed} failed` : ''}`);
    setSelected(new Set());
    setResending(new Set());
    fetchData();
  };

  const bulkDelete = async () => {
    if (selected.size === 0) {
      toast.error('Select at least one guest');
      return;
    }
    const ids = Array.from(selected);
    if (!confirm(`Delete ${ids.length} selected guest${ids.length > 1 ? 's' : ''}? This cannot be undone.`)) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/guests/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestIds: ids }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Deleted ${data.count} guest${data.count > 1 ? 's' : ''}`);
        setSelected(new Set());
        fetchData();
      } else {
        toast.error(data.error || 'Failed to delete');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(false);
    }
  };

  const resendInvitation = async (guestId: string) => {
    if (!confirm('Resend invitation to this guest?')) return;
    setResending(new Set([guestId]));
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
      setResending(new Set());
    }
  };

  const startEditing = (guest: Guest, field: 'name' | 'phone') => {
    setEditing({ id: guest.id, field });
    setEditValue(field === 'name' ? guest.name : guest.phone);
  };

  const saveEdit = async (guest: Guest) => {
    if (!editValue.trim()) {
      toast.error('Value cannot be empty');
      return;
    }
    try {
      const res = await fetch(`/api/guests/${guest.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [editing!.field]: editValue.trim() }),
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Guest updated');
        fetchData();
        setEditing(null);
        setEditValue('');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Update failed');
      }
    } catch {
      toast.error('Network error');
    }
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue('');
  };

  const deleteGuest = async (guestId: string) => {
    if (!confirm('Delete this guest?')) return;
    try {
      const res = await fetch(`/api/guests/${guestId}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) {
        toast.success('Guest deleted');
        fetchData();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Delete failed');
      }
    } catch {
      toast.error('Network error');
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

  const isResending = (id: string) => resending.has(id);

  const renderGuestItem = (guest: Guest) => {
    const status = getStatus(guest);
    const statusClass = guest.checkedIn ? 'status-checked' : (guest.invitationSentAt ? 'status-sent' : 'status-pending');
    const isSelected = selected.has(guest.id);
    const isEditingName = editing?.id === guest.id && editing?.field === 'name';
    const isEditingPhone = editing?.id === guest.id && editing?.field === 'phone';

    return (
      <div key={guest.id}>
        {/* Mobile Card */}
        <div className="guest-card sm:hidden">
          <div className="flex items-center gap-2 mb-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelect(guest.id)}
              className="w-4 h-4 rounded border-gray-300 text-[#0D4F4F] focus:ring-[#0D4F4F]"
            />
            <div className="flex-1 flex justify-between">
              <div>
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="border rounded px-2 py-1 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4F4F]"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(guest)} className="text-green-600 hover:text-green-800"><Check size={16} /></button>
                    <button onClick={cancelEdit} className="text-red-500 hover:text-red-700"><X size={16} /></button>
                  </div>
                ) : (
                  <span className="guest-name">{guest.name}</span>
                )}
                {isEditingPhone ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="border rounded px-2 py-1 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4F4F]"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(guest)} className="text-green-600 hover:text-green-800"><Check size={16} /></button>
                    <button onClick={cancelEdit} className="text-red-500 hover:text-red-700"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="guest-phone">{guest.phone}</div>
                )}
              </div>
              <div className="flex gap-1">
                <button onClick={() => startEditing(guest, 'name')} className="text-[#0D4F4F] hover:text-[#0A3D3D]" title="Edit name"><Edit2 size={14} /></button>
                <button onClick={() => startEditing(guest, 'phone')} className="text-[#0D4F4F] hover:text-[#0A3D3D]" title="Edit phone"><Edit2 size={14} /></button>
                <button onClick={() => deleteGuest(guest.id)} className="text-red-500 hover:text-red-700" title="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`channel-badge ${guest.routingChannel === 'whatsapp' ? 'channel-whatsapp' : 'channel-sms'}`}>
              {guest.routingChannel === 'whatsapp' ? <MessageCircle size={12} /> : <Phone size={12} />}
              {guest.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}
            </span>
            <span className={`status-badge ${statusClass}`}>
              {status.icon} {status.label}
            </span>
            <span className="sent-date">
              {guest.invitationSentAt ? new Date(guest.invitationSentAt).toLocaleString() : 'Not sent'}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            <span className="event-name">{guest.event.name}</span>
            <span className="event-date ml-2">{new Date(guest.event.date).toLocaleDateString()}</span>
          </div>
          <div className="mt-2">
            <button
              className="action-btn"
              onClick={() => resendInvitation(guest.id)}
              disabled={isResending(guest.id)}
            >
              {isResending(guest.id) ? '...' : (guest.invitationSentAt ? 'Resend' : 'Send Now')}
            </button>
          </div>
        </div>

        {/* Desktop Table Row */}
        <tr className="hidden sm:table-row hover:bg-gray-50/50">
          <td className="px-4 py-3">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => toggleSelect(guest.id)}
              className="w-4 h-4 rounded border-gray-300 text-[#0D4F4F] focus:ring-[#0D4F4F]"
            />
          </td>
          <td className="px-4 py-3">
            {isEditingName ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  className="border rounded px-2 py-1 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4F4F]"
                  autoFocus
                />
                <button onClick={() => saveEdit(guest)} className="text-green-600 hover:text-green-800"><Check size={16} /></button>
                <button onClick={cancelEdit} className="text-red-500 hover:text-red-700"><X size={16} /></button>
              </div>
            ) : (
              <div>
                <div className="font-semibold">{guest.name}</div>
                {isEditingPhone ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="border rounded px-2 py-1 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4F4F]"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(guest)} className="text-green-600 hover:text-green-800"><Check size={16} /></button>
                    <button onClick={cancelEdit} className="text-red-500 hover:text-red-700"><X size={16} /></button>
                  </div>
                ) : (
                  <div className="text-xs text-gray-500 font-mono">{guest.phone}</div>
                )}
              </div>
            )}
          </td>
          <td className="px-4 py-3">
            <div className="text-sm font-medium">{guest.event.name}</div>
            <div className="text-xs text-gray-400">{new Date(guest.event.date).toLocaleDateString()}</div>
          </td>
          <td className="px-4 py-3">
            {guest.routingChannel === 'whatsapp' ? (
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
            {guest.invitationSentAt ? new Date(guest.invitationSentAt).toLocaleString() : '—'}
          </td>
          <td className="px-4 py-3">
            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusClass === 'status-checked' ? 'bg-green-50 text-green-700' : statusClass === 'status-sent' ? 'bg-blue-50 text-[#0D4F4F]' : 'bg-amber-50 text-amber-700'}`}>
              {status.icon} {status.label}
            </span>
          </td>
          <td className="px-4 py-3 text-right">
            <div className="flex items-center justify-end gap-2">
              <button onClick={() => startEditing(guest, 'name')} className="text-[#0D4F4F] hover:text-[#0A3D3D]" title="Edit name"><Edit2 size={14} /></button>
              <button onClick={() => startEditing(guest, 'phone')} className="text-[#0D4F4F] hover:text-[#0A3D3D]" title="Edit phone"><Edit2 size={14} /></button>
              <button onClick={() => deleteGuest(guest.id)} className="text-red-500 hover:text-red-700" title="Delete"><Trash2 size={14} /></button>
              <button
                className="inv-resend-btn"
                onClick={() => resendInvitation(guest.id)}
                disabled={isResending(guest.id)}
              >
                {isResending(guest.id) ? '...' : (guest.invitationSentAt ? 'Resend' : 'Send Now')}
              </button>
            </div>
          </td>
        </tr>
      </div>
    );
  };

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

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: white;
          border-radius: 16px;
          padding: 16px 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          text-align: center;
        }
        .stat-value {
          font-family: 'Playfair Display', serif;
          font-size: 28px;
          font-weight: 900;
          color: #0D1B1B;
        }
        .stat-label {
          font-size: 12px;
          color: #9BAAB8;
          font-weight: 600;
          margin-top: 4px;
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 24px;
        }

        .filter-select {
          padding: 8px 12px;
          border: 1.5px solid #E2EAF0;
          border-radius: 10px;
          font-size: 13px;
          font-family: inherit;
          background: white;
          outline: none;
          transition: border-color 0.15s;
        }
        .filter-select:focus {
          border-color: #0D4F4F;
        }

        .refresh-btn {
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
        .refresh-btn:hover {
          border-color: #0D4F4F;
          color: #0D4F4F;
        }

        .table-wrap {
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

        .empty-state {
          padding: 48px 24px;
          text-align: center;
          color: #9BAAB8;
        }
        .empty-icon {
          font-size: 40px;
          margin-bottom: 12px;
        }

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

        .bulk-bar {
          background: white;
          padding: 10px 16px;
          border-radius: 12px;
          border: 1px solid #E2EAF0;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }
        .bulk-bar .selected-info {
          font-size: 14px;
          font-weight: 600;
          color: #0D1B1B;
        }
        .bulk-bar button {
          background: none;
          border: 1.5px solid #E2EAF0;
          border-radius: 8px;
          padding: 4px 14px;
          font-size: 13px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          white-space: nowrap;
        }
        .bulk-bar button:hover {
          border-color: #0D4F4F;
          background: rgba(13,79,79,0.04);
        }
        .bulk-bar .send-btn {
          background: #0D4F4F;
          color: white;
          border-color: #0D4F4F;
        }
        .bulk-bar .send-btn:hover {
          background: #0A3D3D;
        }
        .bulk-bar .delete-btn {
          color: #C0392B;
          border-color: #FECACA;
        }
        .bulk-bar .delete-btn:hover {
          background: #FEF2F2;
        }

        @media (max-width: 640px) {
          .page-title { font-size: 28px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .filter-select { flex: 1; min-width: 120px; }
          .bulk-bar { flex-direction: column; align-items: stretch; gap: 8px; }
          .bulk-bar .selected-info { text-align: center; }
          .bulk-bar button { justify-content: center; }
        }
      `}</style>

      <div className="page-header">
        <div>
          <div className="page-eyebrow">Guest Management</div>
          <h1 className="page-title">All <span>Guests</span></h1>
          <p className="page-sub">View and manage all your guests across events.</p>
        </div>
        <button className="refresh-btn" onClick={fetchData}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Guests</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.sent}</div>
          <div className="stat-label">Sent</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.checkedIn}</div>
          <div className="stat-label">Checked In</div>
        </div>
      </div>

      <div className="filters">
        <select className="filter-select" value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
          <option value="">All Events</option>
          {events.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="sent">Sent</option>
          <option value="checked_in">Checked In</option>
        </select>
        <select className="filter-select" value={filterChannel} onChange={e => setFilterChannel(e.target.value)}>
          <option value="">All Channels</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS</option>
        </select>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="selected-info">{selected.size} selected</span>
          <button onClick={toggleSelectAll}>Deselect All</button>
          <button className="send-btn" onClick={bulkSend} disabled={resending.size > 0 || deleting}>
            {resending.size > 0 ? 'Sending...' : <><Send size={14} /> Send Selected</>}
          </button>
          <button className="delete-btn" onClick={bulkDelete} disabled={deleting || resending.size > 0}>
            {deleting ? 'Deleting...' : <><Trash2 size={14} /> Delete Selected</>}
          </button>
        </div>
      )}

      <div className="table-wrap">
        {loading ? (
          <div className="p-6 text-center">Loading...</div>
        ) : guests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <p className="font-semibold text-gray-700">No guests found</p>
            <p className="text-sm">Add guests to your events to see them here.</p>
          </div>
        ) : (
          <>
            <div className="sm:hidden p-3 max-h-[500px] overflow-y-auto">
              {guests.map(renderGuestItem)}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === guests.length && guests.length > 0}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-[#0D4F4F] focus:ring-[#0D4F4F]"
                      />
                    </th>
                    <th className="px-4 py-2 text-left whitespace-nowrap">Guest</th>
                    <th className="px-4 py-2 text-left whitespace-nowrap">Event</th>
                    <th className="px-4 py-2 text-left whitespace-nowrap">Channel</th>
                    <th className="px-4 py-2 text-left whitespace-nowrap">Sent Date</th>
                    <th className="px-4 py-2 text-left whitespace-nowrap">Status</th>
                    <th className="px-4 py-2 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {guests.map(renderGuestItem)}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}