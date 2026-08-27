'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';
import {
  CheckCircle, Users, RefreshCw, XCircle, ShieldCheck,
  Clock, Trash2, Search, UserCheck, AlertCircle,
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  tenant: { name: string } | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setUsers(data);
      else toast.error(data.error || 'Failed to load users');
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const toggleActive = async (userId: string, currentStatus: boolean) => {
    const action = currentStatus ? 'deactivate' : 'activate';
    const ok = await confirmToast({ title: `${action === 'activate' ? 'Activate' : 'Deactivate'} this user?`, confirmText: action === 'activate' ? 'Activate' : 'Deactivate' });
    if (!ok) return;
    setProcessing(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/${action}`, {
        method: 'PATCH', credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`User ${action}d successfully`);
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: !currentStatus } : u));
      } else {
        toast.error(data.error || `Failed to ${action} user`);
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProcessing(null);
    }
  };

  const deleteUser = async (userId: string, userName: string) => {
    const ok = await confirmToast({ title: `Delete user "${userName}"?`, message: 'This action cannot be undone.', confirmText: 'Delete', danger: true });
    if (!ok) return;
    setProcessing(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE', credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`User "${userName}" deleted successfully`);
        setUsers(prev => prev.filter(u => u.id !== userId));
      } else {
        toast.error(data.error || 'Failed to delete user');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setProcessing(null);
    }
  };

  const inactiveUsers = users.filter(u => {
    const matchesSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return !u.isActive && matchesSearch;
  });
  const activeUsers = users.filter(u => {
    const matchesSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase());
    return u.isActive && matchesSearch;
  });

  const stats = [
    { label: 'Pending', value: inactiveUsers.length, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Active', value: activeUsers.length, icon: ShieldCheck, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Total', value: users.length, icon: Users, color: 'text-[#0D4B4B]', bg: 'bg-[#0D4B4B]/5' },
  ];

  const UserRow = ({ user, isPending }: { user: User; isPending: boolean }) => (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors group">
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
        isPending ? 'bg-gradient-to-br from-[#0D4B4B] to-[#0D4B4B]' : 'bg-gradient-to-br from-green-500 to-green-600'
      }`}>
        {user.name?.charAt(0).toUpperCase() ?? '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{user.name}</p>
        <p className="text-xs text-gray-400 truncate">{user.email}</p>
        <p className="text-[11px] text-gray-300 mt-0.5">
          {user.tenant?.name ?? 'No tenant'} &middot; Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => toggleActive(user.id, user.isActive)}
          disabled={processing === user.id}
          className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
            isPending
              ? 'bg-[#0D4B4B] text-white hover:bg-[#0D4B4B] shadow-sm hover:shadow-md'
              : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
          }`}
        >
          {processing === user.id ? (
            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : isPending ? (
            <CheckCircle size={14} />
          ) : (
            <XCircle size={14} />
          )}
          <span className="hidden sm:inline">{isPending ? 'Activate' : 'Deactivate'}</span>
        </button>
        <button
          onClick={() => deleteUser(user.id, user.name)}
          disabled={processing === user.id}
          className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
          title="Delete user"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );

  const SkeletonRow = () => (
    <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-50">
      <div className="w-10 h-10 rounded-full bg-gray-100 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-gray-100 rounded-full w-1/3 animate-pulse" />
        <div className="h-3 bg-gray-50 rounded-full w-1/2 animate-pulse" />
      </div>
      <div className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Activate, deactivate, or remove user accounts</p>
        </div>
        <button
          onClick={fetchUsers}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                <stat.icon size={18} className={stat.color} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] transition-colors"
        />
      </div>

      {/* Pending Users */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock size={16} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Pending Activation</h2>
              <p className="text-xs text-gray-400">Accounts awaiting approval</p>
            </div>
          </div>
          <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">{inactiveUsers.length}</span>
        </div>

        {loading ? (
          [1, 2].map(i => <SkeletonRow key={i} />)
        ) : inactiveUsers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center">
                <CheckCircle size={24} className="text-green-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">All caught up</p>
                <p className="text-xs text-gray-400 mt-1">No accounts waiting for activation</p>
              </div>
            </div>
          </div>
        ) : (
          inactiveUsers.map(user => <UserRow key={user.id} user={user} isPending />)
        )}
      </div>

      {/* Active Users */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center">
              <ShieldCheck size={16} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Active Users</h2>
              <p className="text-xs text-gray-400">Currently active accounts</p>
            </div>
          </div>
          <span className="text-xs font-bold text-green-600 bg-green-50 px-2.5 py-1 rounded-lg">{activeUsers.length}</span>
        </div>

        {loading ? (
          [1, 2, 3].map(i => <SkeletonRow key={i} />)
        ) : activeUsers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                <Users size={24} className="text-gray-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">No active users</p>
                <p className="text-xs text-gray-400 mt-1">Activate a pending account to get started</p>
              </div>
            </div>
          </div>
        ) : (
          activeUsers.map(user => <UserRow key={user.id} user={user} isPending={false} />)
        )}
      </div>
    </div>
  );
}
