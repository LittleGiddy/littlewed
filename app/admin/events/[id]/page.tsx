'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Calendar, MapPin, Users, Clock, CheckCircle, XCircle,
  UserCheck, MessageSquare, Send, Smartphone, Mail, Phone, Search,
  RefreshCw, ExternalLink, TrendingUp, BarChart3, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EventDetails {
  id: string;
  name: string;
  date: string;
  time: string;
  venue: string;
  address: string;
  status: string;
  createdAt: string;
  hostFamily: string;
  person1: string;
  person2: string;
  totalBudget: number;
  commissionPaid: boolean;
  reminderSent: boolean;
  expiresAt: string;
  pausedAt: string;
  resumedAt: string;
  tenant: { id: string; name: string; subdomain: string };
  stats: {
    totalGuests: number;
    checkedIn: number;
    invited: number;
    delivered: number;
    opened: number;
    thanked: number;
    attending: number;
    pending: number;
    declined: number;
    singleGuests: number;
    doubleGuests: number;
    totalMessages: number;
    deliveredMessages: number;
    failedMessages: number;
  };
  guests: any[];
}

export default function EventDetailPage() {
  const params = useParams();
  const eventId = params.id as string;
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestSearch, setGuestSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/admin/events/${eventId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed');
      setEvent(await res.json());
    } catch {
      toast.error('Failed to load event');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEvent(); }, [eventId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-100 rounded-full w-48 animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!event) return <div className="text-center py-12 text-gray-500">Event not found</div>;

  const s = event.stats;
  const filteredGuests = event.guests.filter(g => {
    const matchesSearch = !guestSearch ||
      g.name?.toLowerCase().includes(guestSearch.toLowerCase()) ||
      g.phone?.includes(guestSearch) ||
      g.cardNumber?.includes(guestSearch);
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'checked-in' && g.checkedIn) ||
      (statusFilter === 'invited' && g.invitationSentAt) ||
      (statusFilter === 'pending' && !g.invitationSentAt);
    return matchesSearch && matchesStatus;
  });

  const deliveryRate = s.invited > 0 ? ((s.delivered / s.invited) * 100).toFixed(0) : '0';
  const checkinRate = s.totalGuests > 0 ? ((s.checkedIn / s.totalGuests) * 100).toFixed(0) : '0';

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link
          href={`/admin/tenants/${event.tenant.id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors mb-4"
        >
          <ArrowLeft size={14} /> Back to {event.tenant.name}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#0D4B4B]/5 flex items-center justify-center">
              <Calendar size={28} className="text-[#0D4B4B]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
                {event.hostFamily && <span>{event.hostFamily}</span>}
                <span className="flex items-center gap-1"><MapPin size={13} />{event.venue}</span>
                <span className="flex items-center gap-1"><Calendar size={13} />{new Date(event.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                {event.time && <span className="flex items-center gap-1"><Clock size={13} />{event.time}</span>}
              </div>
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-lg ${
            event.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border border-green-200' :
            event.status === 'LIVE' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
            event.status === 'EXPIRED' ? 'bg-red-50 text-red-600 border border-red-200' :
            event.status === 'DRAFT' ? 'bg-gray-100 text-gray-600 border border-gray-200' :
            'bg-gray-50 text-gray-500 border border-gray-200'
          }`}>{event.status}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Guests', value: s.totalGuests, icon: Users, color: 'text-gray-900', bg: 'bg-gray-50' },
          { label: 'Checked In', value: s.checkedIn, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50', sub: `${checkinRate}%` },
          { label: 'Attending', value: s.attending, icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pending', value: s.pending, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Declined', value: s.declined, icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Invited', value: s.invited, icon: Send, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Delivered', value: s.delivered, icon: MessageSquare, color: 'text-[#0D4B4B]', bg: 'bg-[#0D4B4B]/5', sub: `${deliveryRate}%` },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon size={14} className={stat.color} />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-none">{stat.value}</p>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{stat.label}</p>
              </div>
            </div>
            {stat.sub && <p className="text-[10px] text-gray-400 mt-1 ml-10">{stat.sub} rate</p>}
          </div>
        ))}
      </div>

      {/* Event Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-900">Event Details</h3>
          </div>
          <div className="p-5 space-y-3">
            {[
              { label: 'Host Family', value: event.hostFamily },
              { label: 'Person 1', value: event.person1 },
              { label: 'Person 2', value: event.person2 },
              { label: 'Venue', value: event.venue },
              { label: 'Address', value: event.address },
              { label: 'Budget', value: event.totalBudget ? `${event.totalBudget.toLocaleString()} TZS` : null },
              { label: 'Created', value: new Date(event.createdAt).toLocaleDateString() },
              { label: 'Tenant', value: event.tenant.name },
            ].filter(f => f.value).map(f => (
              <div key={f.label}>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{f.label}</p>
                <p className="text-sm text-gray-700">{f.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Guest List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-gray-900">Guest List</h3>
              <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{s.totalGuests}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={guestSearch}
                  onChange={e => setGuestSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 w-44"
                />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none">
                <option value="all">All</option>
                <option value="checked-in">Checked In</option>
                <option value="invited">Invited</option>
                <option value="pending">Pending</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Guest</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Contact</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Delivery</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Card</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredGuests.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">No guests found</td></tr>
                ) : (
                  filteredGuests.map(g => (
                    <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{g.name}</p>
                          <p className="text-[10px] text-gray-400">{g.guestType} &middot; {g.title || 'Mr'}</p>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="text-xs text-gray-500 space-y-0.5">
                          {g.phone && <div className="flex items-center gap-1"><Phone size={10} />{g.phone}</div>}
                          {g.email && <div className="flex items-center gap-1"><Mail size={10} />{g.email}</div>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-0.5">
                          {g.checkedIn ? (
                            <span className="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full w-fit">Checked In</span>
                          ) : g.attending === 'attending' ? (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full w-fit">Attending</span>
                          ) : g.attending === 'declined' ? (
                            <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full w-fit">Declined</span>
                          ) : (
                            <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full w-fit">Pending</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className={`w-1.5 h-1.5 rounded-full ${g.deliveredMessages > 0 ? 'bg-green-500' : g.totalMessages > 0 ? 'bg-amber-500' : 'bg-gray-300'}`} />
                          {g.deliveredMessages}/{g.totalMessages}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-mono text-gray-500">{g.cardNumber || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
