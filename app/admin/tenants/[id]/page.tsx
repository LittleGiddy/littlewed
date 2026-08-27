'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Building2, Users, Calendar, CreditCard, Settings, UserCog,
  TrendingUp, CheckCircle, XCircle, Clock, Mail, Phone, Search,
  RefreshCw, ToggleLeft, ToggleRight, Save, Trash2, Eye, ExternalLink,
  MessageSquare, MapPin, DollarSign, BarChart3, Activity, AlertTriangle,
  ChevronRight, UserCheck, Send, Smartphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';

type Tab = 'overview' | 'events' | 'staff' | 'guests' | 'settings';

interface TenantDetails {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  status: string;
  subscriptionStatus: string;
  credits: number;
  maxGuests: number;
  simpleEventMode: boolean;
  bypassPayment: boolean;
  testMode: boolean;
  adminEmail: string;
  createdAt: string;
  stats: {
    totalUsers: number;
    totalEvents: number;
    totalTransactions: number;
    totalGuests: number;
    activeEvents: number;
    staffCount: number;
    clientCount: number;
    totalRevenue: number;
  };
  events: any[];
  staff: any[];
  clients: any[];
  transactions: any[];
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [tab, setTab] = useState<Tab>('overview');
  const [tenant, setTenant] = useState<TenantDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [guestSearch, setGuestSearch] = useState('');
  const [guestEventFilter, setGuestEventFilter] = useState('all');
  const [guests, setGuests] = useState<any[]>([]);
  const [loadingGuests, setLoadingGuests] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>({});

  const fetchTenant = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/details`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load tenant');
      const data = await res.json();
      setTenant(data);
      setSettingsForm({
        plan: data.plan,
        maxGuests: data.maxGuests,
        credits: data.credits,
        simpleEventMode: data.simpleEventMode,
        bypassPayment: data.bypassPayment,
        testMode: data.testMode,
        subscriptionStatus: data.subscriptionStatus,
        adminEmail: data.adminEmail || '',
      });
    } catch {
      toast.error('Failed to load tenant details');
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const fetchGuests = useCallback(async () => {
    setLoadingGuests(true);
    try {
      const url = guestEventFilter !== 'all'
        ? `/api/admin/tenants/${tenantId}/guests?eventId=${guestEventFilter}`
        : `/api/admin/tenants/${tenantId}/guests`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load guests');
      setGuests(await res.json());
    } catch {
      toast.error('Failed to load guests');
    } finally {
      setLoadingGuests(false);
    }
  }, [tenantId, guestEventFilter]);

  useEffect(() => { fetchTenant(); }, [fetchTenant]);
  useEffect(() => { if (tab === 'guests') fetchGuests(); }, [tab, fetchGuests]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settingsForm),
        credentials: 'include',
      });
      if (res.ok) {
        toast.success('Settings saved');
        fetchTenant();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to save');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    const newStatus = tenant?.subscriptionStatus === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include',
      });
      if (res.ok) { toast.success(`Tenant ${newStatus}`); fetchTenant(); }
      else { const data = await res.json().catch(() => null); toast.error(data?.error || 'Failed to update status'); }
    } catch { toast.error('Network error'); }
  };

  const deleteTenant = async () => {
    const ok = await confirmToast({
      title: `Delete "${tenant?.name}"?`,
      message: 'This action cannot be undone. It will delete the tenant and ALL its data.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/delete`, { method: 'POST', credentials: 'include' });
      if (res.ok) { toast.success('Tenant deleted'); router.push('/admin/tenants'); }
      else { const data = await res.json().catch(() => null); toast.error(data?.error || 'Failed to delete tenant'); }
    } catch { toast.error('Network error'); }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-100 rounded-full w-48 animate-pulse" />
        <div className="h-64 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!tenant) return <div className="text-center py-12 text-gray-500">Tenant not found</div>;

  const s = tenant.stats;
  const filteredGuests = guests.filter(g => {
    if (!guestSearch) return true;
    const q = guestSearch.toLowerCase();
    return g.name?.toLowerCase().includes(q) || g.phone?.includes(q) || g.email?.toLowerCase().includes(q) || g.cardNumber?.includes(q);
  });

  const tabs: { key: Tab; label: string; icon: any; count?: number }[] = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'events', label: 'Events', icon: Calendar, count: s.totalEvents },
    { key: 'staff', label: 'Staff', icon: UserCog, count: s.staffCount },
    { key: 'guests', label: 'Guests', icon: Users, count: s.totalGuests },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <Link href="/admin/tenants" className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors mb-4">
          <ArrowLeft size={14} /> Back to Tenants
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-[#0D4B4B]/5 flex items-center justify-center">
              <Building2 size={28} className="text-[#0D4B4B]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
              <p className="text-sm text-gray-500">{tenant.subdomain} &middot; {tenant.plan} plan</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={toggleStatus} className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all border ${
              tenant.subscriptionStatus === 'active'
                ? 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100'
                : 'text-red-600 bg-red-50 border-red-200 hover:bg-red-100'
            }`}>
              {tenant.subscriptionStatus === 'active' ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
              {tenant.subscriptionStatus === 'active' ? 'Active' : 'Inactive'}
            </button>
            <button onClick={deleteTenant} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors">
              <Trash2 size={14} /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-0 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${
                tab === t.key
                  ? 'border-[#0D4B4B] text-[#0D4B4B]'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
              }`}
            >
              <t.icon size={16} />
              {t.label}
              {t.count !== undefined && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === t.key ? 'bg-[#0D4B4B]/10 text-[#0D4B4B]' : 'bg-gray-100 text-gray-500'
                }`}>{t.count}</span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {/* ─── OVERVIEW ─────────────────────────────────────────── */}
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Users', value: s.totalUsers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Events', value: s.totalEvents, icon: Calendar, color: 'text-[#0D4B4B]', bg: 'bg-[#0D4B4B]/5' },
                { label: 'Guests', value: s.totalGuests, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
                { label: 'Staff', value: s.staffCount, icon: UserCog, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Active Events', value: s.activeEvents, icon: Activity, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Credits', value: tenant.credits, icon: CreditCard, color: 'text-[#0D4B4B]', bg: 'bg-[#0D4B4B]/5' },
                { label: 'Revenue', value: `${(s.totalRevenue / 1000).toFixed(0)}k`, icon: DollarSign, color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Pending Events', value: tenant.events.filter((e: any) => e.status === 'PENDING').length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
              ].map(stat => (
                <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                      <stat.icon size={18} className={stat.color} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Info Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Users */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Users ({s.totalUsers})</h3>
                  <span className="text-xs text-gray-400">{s.clientCount} clients, {s.staffCount} staff</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {tenant.clients.map(c => (
                    <div key={c.id} className="px-5 py-3 border-b border-gray-50 last:border-0 flex items-center gap-3 hover:bg-gray-50/50">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">{c.name?.charAt(0)?.toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                        <p className="text-xs text-gray-400 truncate">{c.email}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.isActive ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {c.isActive ? 'Active' : 'Pending'}
                      </span>
                    </div>
                  ))}
                  {tenant.staff.map(s => (
                    <div key={s.id} className="px-5 py-3 border-b border-gray-50 last:border-0 flex items-center gap-3 hover:bg-gray-50/50">
                      <div className="w-8 h-8 rounded-full bg-violet-500 flex items-center justify-center text-white text-xs font-bold">{s.name?.charAt(0)?.toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                        <p className="text-xs text-gray-400 truncate">{s.email}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">Staff</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Events */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Recent Events</h3>
                  <button onClick={() => setTab('events')} className="text-xs font-semibold text-[#0D4B4B] hover:text-[#0D4B4B]">View all</button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {tenant.events.slice(0, 5).map(e => (
                    <Link key={e.id} href={`/admin/events/${e.id}`} className="px-5 py-3 border-b border-gray-50 last:border-0 flex items-center gap-3 hover:bg-gray-50/50 block">
                      <div className="w-8 h-8 rounded-lg bg-[#0D4B4B]/5 flex items-center justify-center text-[#0D4B4B]"><Calendar size={14} /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{e.name}</p>
                        <p className="text-xs text-gray-400">{e.guestCount} guests &middot; {new Date(e.date).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        e.status === 'ACTIVE' ? 'bg-green-50 text-green-700' :
                        e.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' :
                        e.status === 'EXPIRED' ? 'bg-red-50 text-red-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>{e.status}</span>
                    </Link>
                  ))}
                  {tenant.events.length === 0 && (
                    <div className="px-5 py-8 text-center text-sm text-gray-400">No events yet</div>
                  )}
                </div>
              </div>
            </div>

            {/* Transactions */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Recent Transactions</h3>
              </div>
              {tenant.transactions.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">No transactions</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead><tr className="border-b border-gray-100">
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Type</th>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Amount</th>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Status</th>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-gray-400 uppercase">Date</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {tenant.transactions.map(t => (
                        <tr key={t.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-2.5 text-sm font-medium text-gray-700">{t.type.replace('_', ' ')}</td>
                          <td className="px-5 py-2.5 text-sm font-semibold text-gray-900">{t.amount.toLocaleString()} TZS</td>
                          <td className="px-5 py-2.5">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
                              t.status === 'COMPLETED' ? 'bg-green-50 text-green-700' :
                              t.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                            }`}>{t.status}</span>
                          </td>
                          <td className="px-5 py-2.5 text-xs text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── EVENTS ──────────────────────────────────────────── */}
        {tab === 'events' && (
          <div className="space-y-4">
            {tenant.events.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 py-16 text-center">
                <Calendar size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-semibold text-gray-900">No events</p>
                <p className="text-xs text-gray-400 mt-1">This tenant has no events yet</p>
              </div>
            ) : (
              tenant.events.map(e => (
                <Link key={e.id} href={`/admin/events/${e.id}`} className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-[#0D4B4B]/30 transition-all group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#0D4B4B]/5 flex items-center justify-center text-[#0D4B4B] group-hover:bg-[#0D4B4B]/10 transition-colors">
                        <Calendar size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{e.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{e.guestCount} guests &middot; {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        {e.hostFamily && <p className="text-xs text-gray-400 mt-0.5">{e.hostFamily}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        e.status === 'ACTIVE' ? 'bg-green-50 text-green-700' :
                        e.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' :
                        e.status === 'EXPIRED' ? 'bg-red-50 text-red-600' :
                        e.status === 'LIVE' ? 'bg-blue-50 text-blue-600' :
                        'bg-gray-50 text-gray-500'
                      }`}>{e.status}</span>
                      <ExternalLink size={14} className="text-gray-300 group-hover:text-[#0D4B4B] transition-colors" />
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}

        {/* ─── STAFF ───────────────────────────────────────────── */}
        {tab === 'staff' && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {tenant.staff.length === 0 ? (
              <div className="py-16 text-center">
                <UserCog size={32} className="mx-auto text-gray-300 mb-3" />
                <p className="text-sm font-semibold text-gray-900">No staff members</p>
                <p className="text-xs text-gray-400 mt-1">Staff accounts will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Staff Member</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Joined</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Activity</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {tenant.staff.map(member => (
                      <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-violet-500 flex items-center justify-center text-white text-sm font-bold">{member.name?.charAt(0)?.toUpperCase()}</div>
                            <span className="text-sm font-semibold text-gray-900">{member.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-gray-500">{member.email}</td>
                        <td className="px-5 py-3.5 text-xs text-gray-500">{new Date(member.createdAt).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5">
                          <span className="text-xs text-gray-400">No activity data</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ─── GUESTS ──────────────────────────────────────────── */}
        {tab === 'guests' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, phone, email, or card #..."
                  value={guestSearch}
                  onChange={e => setGuestSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B]"
                />
              </div>
              <select
                value={guestEventFilter}
                onChange={e => setGuestEventFilter(e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20"
              >
                <option value="all">All Events</option>
                {tenant.events.map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
              <button onClick={fetchGuests} disabled={loadingGuests} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 flex items-center gap-1.5">
                <RefreshCw size={14} className={loadingGuests ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr className="border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Guest</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Event</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Contact</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Delivery</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Card</th>
                  </tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {loadingGuests ? (
                      [...Array(3)].map((_, i) => (
                        <tr key={i}><td colSpan={6} className="px-5 py-4"><div className="h-4 bg-gray-100 rounded-full animate-pulse w-1/2" /></td></tr>
                      ))
                    ) : filteredGuests.length === 0 ? (
                      <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-gray-400">No guests found</td></tr>
                    ) : (
                      filteredGuests.slice(0, 50).map(g => (
                        <tr key={g.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-5 py-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{g.name}</p>
                              <p className="text-[11px] text-gray-400">{g.guestType} &middot; {g.routingChannel}</p>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-xs text-gray-500">{g.event?.name}</td>
                          <td className="px-5 py-3">
                            <div className="text-xs text-gray-500 space-y-0.5">
                              {g.phone && <div className="flex items-center gap-1"><Phone size={10} />{g.phone}</div>}
                              {g.email && <div className="flex items-center gap-1"><Mail size={10} />{g.email}</div>}
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex flex-col gap-1">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-fit ${
                                g.checkedIn ? 'bg-green-50 text-green-700' :
                                g.attending === 'attending' ? 'bg-blue-50 text-blue-700' :
                                g.attending === 'declined' ? 'bg-red-50 text-red-600' :
                                'bg-gray-100 text-gray-500'
                              }`}>
                                {g.checkedIn ? 'Checked In' : g.attending || 'Pending'}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Send size={10} className={g.invitationSentAt ? 'text-green-500' : 'text-gray-300'} />
                              {g.deliveredMessages}/{g.totalMessages} delivered
                            </div>
                          </td>
                          <td className="px-5 py-3 text-xs font-mono text-gray-500">{g.cardNumber || '—'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {!loadingGuests && filteredGuests.length > 50 && (
                <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
                  Showing 50 of {filteredGuests.length} guests
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── SETTINGS ────────────────────────────────────────── */}
        {tab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#0D4B4B]/5 flex items-center justify-center"><Settings size={16} className="text-[#0D4B4B]" /></div>
                <h3 className="text-sm font-semibold text-gray-900">Tenant Settings</h3>
              </div>
              <div className="p-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Plan</label>
                    <select value={settingsForm.plan} onChange={e => setSettingsForm({ ...settingsForm, plan: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 bg-white">
                      <option value="BASIC">Basic</option>
                      <option value="PRO">Pro</option>
                      <option value="ENTERPRISE">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Max Guests</label>
                    <input type="number" value={settingsForm.maxGuests} onChange={e => setSettingsForm({ ...settingsForm, maxGuests: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Credits</label>
                    <input type="number" value={settingsForm.credits} onChange={e => setSettingsForm({ ...settingsForm, credits: parseInt(e.target.value) || 0 })}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Subscription</label>
                    <select value={settingsForm.subscriptionStatus} onChange={e => setSettingsForm({ ...settingsForm, subscriptionStatus: e.target.value })}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 bg-white">
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Notifications</p>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Admin Email for Credit Requests</label>
                    <input type="email" value={settingsForm.adminEmail || ''} onChange={e => setSettingsForm({ ...settingsForm, adminEmail: e.target.value })}
                      placeholder="admin@example.com"
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20" />
                    <p className="text-[11px] text-gray-400 mt-1">Receives email notifications when users request credits.</p>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Feature Toggles</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { key: 'simpleEventMode', label: 'Simple Event Mode', desc: 'Simplified event creation' },
                      { key: 'bypassPayment', label: 'Bypass Payment', desc: 'Skip payment requirements' },
                      { key: 'testMode', label: 'Test Mode', desc: 'Run in test/sandbox mode' },
                    ].map(f => (
                      <button key={f.key} onClick={() => setSettingsForm({ ...settingsForm, [f.key]: !settingsForm[f.key] })}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${
                          settingsForm[f.key] ? 'border-[#0D4B4B] bg-[#0D4B4B]/5' : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {settingsForm[f.key] ? <ToggleRight size={18} className="text-[#0D4B4B]" /> : <ToggleLeft size={18} className="text-gray-400" />}
                          <span className="text-sm font-semibold text-gray-900">{f.label}</span>
                        </div>
                        <p className="text-xs text-gray-400">{f.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button onClick={saveSettings} disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0D4B4B] text-white text-sm font-semibold rounded-xl hover:bg-[#0D4B4B] transition-colors shadow-sm disabled:opacity-50">
                    {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={16} />}
                    Save Changes
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
