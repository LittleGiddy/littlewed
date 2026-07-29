import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { 
  Building2, Users, UserCog, CreditCard, TrendingUp, 
  ArrowUp, ArrowDown, Users as UsersIcon, CheckCircle,
  Clock, AlertCircle, Calendar, Activity
} from 'lucide-react';
import Link from 'next/link';
import { ActivityFeed } from './components/ActivityFeed';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== 'SUPER_ADMIN') redirect('/login');

  // ─── Stats ──────────────────────────────────────────────────────────────
  const [
    totalTenants,
    totalUsers,
    totalStaff,
    activeSubscriptions,
    pendingUsers,
    totalCredits,
    recentActivity,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.user.count({ where: { role: 'CLIENT' } }),
    prisma.user.count({ where: { role: 'STAFF' } }),
    prisma.tenant.count({ where: { subscriptionStatus: 'active' } }),
    prisma.user.count({ where: { isActive: false, role: 'CLIENT' } }),
    prisma.tenant.aggregate({ _sum: { credits: true } }),
    prisma.transaction.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { tenant: { select: { name: true } } },
    }),
  ]);

  const stats = [
    {
      label: 'Total Tenants',
      value: totalTenants,
      icon: <Building2 size={20} />,
      color: '#0D4F4F',
      bg: 'rgba(13,79,79,0.08)',
      change: '+12%',
      trend: 'up',
    },
    {
      label: 'Active Subscriptions',
      value: activeSubscriptions,
      icon: <CheckCircle size={20} />,
      color: '#1A7A4A',
      bg: 'rgba(26,122,74,0.08)',
      change: '+8%',
      trend: 'up',
    },
    {
      label: 'Total Clients',
      value: totalUsers,
      icon: <Users size={20} />,
      color: '#C07A20',
      bg: 'rgba(192,122,32,0.08)',
      change: '+5%',
      trend: 'up',
    },
    {
      label: 'Pending Approvals',
      value: pendingUsers,
      icon: <Clock size={20} />,
      color: '#C0392B',
      bg: 'rgba(192,57,43,0.08)',
      change: pendingUsers > 0 ? `${pendingUsers} waiting` : 'All clear',
      trend: pendingUsers > 0 ? 'down' : 'up',
    },
    {
      label: 'Total Staff',
      value: totalStaff,
      icon: <UserCog size={20} />,
      color: '#4A6072',
      bg: 'rgba(74,96,114,0.08)',
      change: 'Active team',
    },
    {
      label: 'System Credits',
      value: totalCredits._sum?.credits ?? 0,
      icon: <CreditCard size={20} />,
      color: '#0D4F4F',
      bg: 'rgba(13,79,79,0.08)',
      change: 'Across all tenants',
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="text-[11px] font-bold tracking-wider text-[#0D4F4F] uppercase mb-2">Overview</div>
        <h1 className="font-serif text-3xl md:text-4xl font-black text-gray-900">
          Admin <span className="text-[#0D4F4F]">Dashboard</span>
        </h1>
        <p className="text-gray-500 text-sm mt-2">
          Monitor all tenants, users, and activity across the platform.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-all"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                <p className="font-serif text-2xl font-bold text-gray-900 mt-1">{stat.value.toLocaleString()}</p>
                {stat.change && (
                  <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.trend === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    {stat.change}
                  </p>
                )}
              </div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: stat.bg, color: stat.color }}>
                {stat.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/admin/tenants/new"
          className="bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white rounded-2xl p-5 shadow-md hover:shadow-lg transition text-center"
        >
          <Building2 size={24} className="mx-auto mb-2" />
          <p className="font-bold text-sm">Create New Tenant</p>
          <p className="text-xs opacity-75">Add a new organisation</p>
        </Link>
        <Link
          href="/admin/users"
          className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition text-center"
        >
          <UsersIcon size={24} className="mx-auto mb-2 text-[#0D4F4F]" />
          <p className="font-bold text-sm text-gray-800">Manage Users</p>
          <p className="text-xs text-gray-400">Activate or deactivate accounts</p>
        </Link>
        <Link
          href="/admin/staff"
          className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition text-center"
        >
          <UserCog size={24} className="mx-auto mb-2 text-[#0D4F4F]" />
          <p className="font-bold text-sm text-gray-800">Staff Management</p>
          <p className="text-xs text-gray-400">View all staff members</p>
        </Link>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-gray-800 flex items-center gap-2">
            <Activity size={18} className="text-[#0D4F4F]" />
            Recent Activity
          </h2>
          <Link href="/admin/activity" className="text-sm font-bold text-[#0D4F4F] hover:underline">
            View All →
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {recentActivity.map((tx) => (
            <div key={tx.id} className="px-6 py-3 flex items-center justify-between hover:bg-gray-50 transition">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {tx.tenant?.name || 'Unknown tenant'} — {tx.type.replace('_', ' ')}
                </p>
                <p className="text-xs text-gray-400">
                  {new Date(tx.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                tx.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                tx.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                'bg-red-100 text-red-700'
              }`}>
                {tx.status}
              </span>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <div className="px-6 py-8 text-center text-gray-400 text-sm">
              No recent activity to show.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}