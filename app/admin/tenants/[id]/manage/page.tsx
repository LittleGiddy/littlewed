'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2, Search, Plus, ChevronDown, RefreshCw, CheckCircle, XCircle,
  ArrowUpDown, Users, CreditCard, ExternalLink, Settings, ToggleLeft, ToggleRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';

interface Tenant {
  id: string;
  name: string;
  subdomain: string;
  plan: string;
  subscriptionStatus: string;
  credits: number;
  users: { id: string }[];
  createdAt: string;
  bypassPayment: boolean;
  testMode: boolean;
}

export default function AdminTenantManagePage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tenants', { credentials: 'include' });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const data = await res.json();
      setTenants(Array.isArray(data) ? data : data.tenants || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const toggleTenantStatus = async (tenantId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const ok = await confirmToast({
      title: `${newStatus === 'active' ? 'Activate' : 'Deactivate'} this tenant?`,
      confirmText: newStatus === 'active' ? 'Activate' : 'Deactivate',
    });
    if (!ok) return;

    setUpdatingStatus(tenantId);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Tenant ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`);
        setTenants(prev => prev.map(t => t.id === tenantId ? { ...t, subscriptionStatus: newStatus } : t));
      } else {
        toast.error(data.error || 'Failed to update status');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const filteredTenants = tenants
    .filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                            t.subdomain.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === 'all' || t.subscriptionStatus === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const aVal = a[sortField as keyof Tenant];
      const bVal = b[sortField as keyof Tenant];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });

  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const activeCount = tenants.filter(t => t.subscriptionStatus === 'active').length;
  const inactiveCount = tenants.filter(t => t.subscriptionStatus !== 'active').length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Management</h1>
          <p className="text-sm text-gray-500 mt-1">Detailed control over individual tenants</p>
        </div>
        <Link
          href="/admin/tenants/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#0D4B4B] text-white text-sm font-semibold rounded-xl hover:bg-[#0D4B4B] transition-colors shadow-sm"
        >
          <Plus size={16} />
          New Tenant
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0D4B4B]/5 flex items-center justify-center">
              <Building2 size={18} className="text-[#0D4B4B]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{tenants.length}</p>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
              <CheckCircle size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Active</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
              <XCircle size={18} className="text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{inactiveCount}</p>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Inactive</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] transition-colors"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] bg-white transition-colors"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          onClick={fetchTenants}
          disabled={loading}
          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors">
                    Tenant <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Subdomain</th>
                <th className="px-6 py-3 text-left">
                  <button onClick={() => handleSort('plan')} className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors">
                    Plan <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Credits</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Users</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-6 py-4">
                      <div className="h-4 bg-gray-100 rounded-full animate-pulse w-3/4" />
                    </td>
                  </tr>
                ))
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                        <Building2 size={24} className="text-gray-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">No tenants found</p>
                        <p className="text-xs text-gray-400 mt-1">Try adjusting your search or filters</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-[#0D4B4B]/5 flex items-center justify-center text-[#0D4B4B] flex-shrink-0">
                          <Building2 size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{tenant.name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {tenant.bypassPayment && (
                              <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-md">Bypass</span>
                            )}
                            {tenant.testMode && (
                              <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md">Test</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-sm text-gray-500 font-mono">{tenant.subdomain}</td>
                    <td className="px-6 py-3.5">
                      <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2.5 py-1 rounded-lg">{tenant.plan}</span>
                    </td>
                    <td className="px-6 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg ${
                        tenant.subscriptionStatus === 'active'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-red-50 text-red-600'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${tenant.subscriptionStatus === 'active' ? 'bg-green-500' : 'bg-red-400'}`} />
                        {tenant.subscriptionStatus === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                        <CreditCard size={13} className="text-gray-400" />
                        {tenant.credits}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Users size={13} className="text-gray-400" />
                        {tenant.users.length}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/tenants/${tenant.id}`}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D4B4B] hover:text-[#0D4B4B] transition-colors"
                        >
                          <Settings size={14} />
                          Manage
                        </Link>
                        <button
                          onClick={() => toggleTenantStatus(tenant.id, tenant.subscriptionStatus)}
                          disabled={updatingStatus === tenant.id}
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                            tenant.subscriptionStatus === 'active'
                              ? 'text-red-600 hover:bg-red-50 border border-red-200'
                              : 'text-green-600 hover:bg-green-50 border border-green-200'
                          }`}
                        >
                          {updatingStatus === tenant.id ? (
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                          ) : tenant.subscriptionStatus === 'active' ? (
                            <ToggleRight size={14} />
                          ) : (
                            <ToggleLeft size={14} />
                          )}
                          {tenant.subscriptionStatus === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      {!loading && tenants.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {filteredTenants.length} of {tenants.length} tenants</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {activeCount} active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              {inactiveCount} inactive
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
