'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Building2, Search, Filter, Plus, ChevronDown, ChevronUp, MoreVertical, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';

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

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/tenants', { credentials: 'include' });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      // ✅ Support both array and object responses
      const tenantList = Array.isArray(data) ? data : data.tenants || [];
      setTenants(tenantList);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load tenants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  const filteredTenants = tenants
    .filter(t => {
      const matchesSearch = t.name.toLowerCase().includes(search.toLowerCase()) ||
                           t.subdomain.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = filterStatus === 'all' || t.subscriptionStatus === filterStatus;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      const fieldA = a[sortField as keyof Tenant];
      const fieldB = b[sortField as keyof Tenant];
      if (typeof fieldA === 'string' && typeof fieldB === 'string') {
        return sortDirection === 'asc' ? fieldA.localeCompare(fieldB) : fieldB.localeCompare(fieldA);
      }
      return sortDirection === 'asc' ? (fieldA as number) - (fieldB as number) : (fieldB as number) - (fieldA as number);
    });

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold tracking-wider text-[#0D4F4F] uppercase mb-2">Management</div>
            <h1 className="font-serif text-3xl font-black text-gray-900">Tenants</h1>
            <p className="text-gray-500 text-sm mt-1">Manage all organisations on the platform.</p>
          </div>
          <Link
            href="/admin/tenants/new"
            className="bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg transition flex items-center gap-2"
          >
            <Plus size={16} /> New Tenant
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4F4F]/20 focus:border-[#0D4F4F]"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4F4F]/20"
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button
          onClick={fetchTenants}
          className="px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold hover:bg-gray-50 transition"
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#FAFBFD] border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-gray-700">
                    Tenant <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Subdomain</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <button onClick={() => handleSort('plan')} className="flex items-center gap-1 hover:text-gray-700">
                    Plan <ArrowUpDown size={12} />
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Credits</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Users</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td colSpan={7} className="px-4 py-4 animate-pulse">
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                    </td>
                  </tr>
                ))
              ) : filteredTenants.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No tenants found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredTenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[rgba(13,79,79,0.08)] flex items-center justify-center text-[#0D4F4F]">
                          <Building2 size={16} />
                        </div>
                        <span className="font-semibold text-sm">{tenant.name}</span>
                        {tenant.bypassPayment && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Bypass</span>
                        )}
                        {tenant.testMode && (
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Test</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{tenant.subdomain}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{tenant.plan}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        tenant.subscriptionStatus === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {tenant.subscriptionStatus === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium">{tenant.credits}</td>
                    <td className="px-4 py-3 text-sm">{tenant.users.length}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/tenants/${tenant.id}/manage`}
                        className="text-sm font-bold text-[#0D4F4F] hover:underline"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}