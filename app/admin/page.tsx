import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import {
  Building2, Users, CreditCard, UserCheck, UserCog,
  TrendingUp, ArrowUpRight, ChevronRight, Sparkles, Activity, Bell,
} from 'lucide-react';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { ActivityFeed } from './components/ActivityFeed';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== 'SUPER_ADMIN') redirect('/login');

  const [tenants, pendingUsers, totalStaff, totalCredits, messageFailure24h, pendingCreditRequests, pushSubscribers, todayCheckIns] = await Promise.all([
    prisma.tenant.findMany({
      include: { users: true },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.user.count({ where: { isActive: false, role: 'CLIENT' } }),
    prisma.user.count({ where: { role: 'STAFF' } }),
    prisma.tenant.aggregate({ _sum: { credits: true } }),
    prisma.messageLog.count({
      where: {
        status: { in: ['FAILED', 'REJECTED'] },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.creditRequest.count({ where: { status: 'PENDING' } }),
    prisma.pushSubscription.count(),
    prisma.guest.count({ where: { checkedInAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);

  const activeSubscriptions = tenants.filter(t => t.subscriptionStatus === 'active').length;
  const totalUsers = tenants.reduce((acc, t) => acc + t.users.length, 0);
  const totalCreditsSum = totalCredits._sum?.credits ?? 0;
  const inactiveTenants = tenants.length - activeSubscriptions;
  const lowCreditTenants = tenants.filter(t => (t.credits ?? 0) <= 0).length;

  const stats = [
    { label: 'Tenants', value: tenants.length, icon: Building2, color: 'text-[#0D4B4B]', bg: 'bg-[#0D4B4B]/5', trend: null },
    { label: 'Active Subs', value: activeSubscriptions, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50', trend: inactiveTenants > 0 ? `${inactiveTenants} inactive` : 'All active' },
    { label: 'Total Users', value: totalUsers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', trend: null },
    { label: 'Pending', value: pendingUsers, icon: UserCheck, color: 'text-amber-600', bg: 'bg-amber-50', trend: pendingUsers > 0 ? 'Needs review' : 'All clear' },
    { label: 'Staff', value: totalStaff, icon: UserCog, color: 'text-violet-600', bg: 'bg-violet-50', trend: null },
    { label: 'Credits', value: totalCreditsSum.toLocaleString(), icon: CreditCard, color: 'text-[#0D4B4B]', bg: 'bg-[#0D4B4B]/5', trend: 'Total pool' },
    { label: 'Push Subscribers', value: pushSubscribers, icon: Bell, color: 'text-sky-600', bg: 'bg-sky-50', trend: 'Web push devices' },
    { label: 'Check-ins Today', value: todayCheckIns, icon: UserCheck, color: 'text-teal-600', bg: 'bg-teal-50', trend: 'Across all events' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-[#0D4B4B]" />
          <span className="text-xs font-bold tracking-wider text-[#0D4B4B] uppercase">Admin Panel</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Platform overview and quick management</p>
      </div>

      {/* Message failure alert */}
      {messageFailure24h > 0 && (
        <Link
          href="/admin/logs"
          className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 hover:bg-red-100/70 transition group"
        >
          <AlertTriangle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">
              {messageFailure24h} message{messageFailure24h > 1 ? 's' : ''} failed in the last 24 hours
            </p>
            <p className="text-xs text-red-600 mt-0.5">Click to review message logs and identify tenants with delivery problems.</p>
          </div>
          <ArrowUpRight size={16} className="text-red-400 group-hover:text-red-600 transition" />
        </Link>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-gray-300 transition-all duration-200 group">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                <stat.icon size={18} className={stat.color} />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-gray-900 leading-none">{stat.value}</p>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-1">{stat.label}</p>
                {stat.trend && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{stat.trend}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions + Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <div className="lg:col-span-2 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/admin/tenants"
              className="group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-[#0D4B4B]/30 transition-all duration-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#0D4B4B]/5 flex items-center justify-center group-hover:bg-[#0D4B4B]/10 transition-colors">
                  <Building2 size={18} className="text-[#0D4B4B]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Manage Tenants</p>
                  <p className="text-xs text-gray-400">{tenants.length} organisations</p>
                </div>
              </div>
              <ArrowUpRight size={16} className="text-gray-300 group-hover:text-[#0D4B4B] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Link>

            <Link
              href="/admin/users"
              className="group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-blue-300 transition-all duration-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <Users size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Manage Users</p>
                  <p className="text-xs text-gray-400">{pendingUsers} pending activation</p>
                </div>
              </div>
              <ArrowUpRight size={16} className="text-gray-300 group-hover:text-blue-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Link>

            <Link
              href="/admin/staff"
              className="group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-violet-300 transition-all duration-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center group-hover:bg-violet-100 transition-colors">
                  <UserCog size={18} className="text-violet-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Staff Members</p>
                  <p className="text-xs text-gray-400">{totalStaff} staff accounts</p>
                </div>
              </div>
              <ArrowUpRight size={16} className="text-gray-300 group-hover:text-violet-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Link>

            <Link
              href="/admin/templates"
              className="group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-amber-300 transition-all duration-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                  <CreditCard size={18} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Templates</p>
                  <p className="text-xs text-gray-400">Invitation templates</p>
                </div>
              </div>
              <ArrowUpRight size={16} className="text-gray-300 group-hover:text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Link>

            <Link
              href="/admin/logs"
              className="group bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-red-300 transition-all duration-200 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center group-hover:bg-red-100 transition-colors">
                  <Activity size={18} className="text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Message Logs</p>
                  <p className="text-xs text-gray-400">{messageFailure24h} failures in last 24h</p>
                </div>
              </div>
              <ArrowUpRight size={16} className="text-gray-300 group-hover:text-red-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </Link>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
          </div>
          <div className="p-5">
            <ActivityFeed />
          </div>
        </div>
      </div>

      {/* Needs Attention */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <h2 className="text-sm font-semibold text-gray-900">Needs Attention</h2>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Actionable items across the platform</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-5">
          <Link href="/admin/credit-requests" className={`rounded-xl border p-4 transition-all hover:shadow-sm ${pendingCreditRequests > 0 ? 'border-amber-200 bg-amber-50/60 hover:bg-amber-50' : 'border-gray-100 bg-gray-50/60'}`}>
            <p className="text-2xl font-bold text-gray-900">{pendingCreditRequests}</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Pending credit requests</p>
            {pendingCreditRequests > 0 && <p className="text-[11px] text-amber-600 mt-1">Review now</p>}
          </Link>
          <Link href="/admin/tenants" className={`rounded-xl border p-4 transition-all hover:shadow-sm ${lowCreditTenants > 0 ? 'border-red-200 bg-red-50/60 hover:bg-red-50' : 'border-gray-100 bg-gray-50/60'}`}>
            <p className="text-2xl font-bold text-gray-900">{lowCreditTenants}</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Tenants with 0 credits</p>
            {lowCreditTenants > 0 && <p className="text-[11px] text-red-600 mt-1">May be blocked</p>}
          </Link>
          <Link href="/admin/users" className={`rounded-xl border p-4 transition-all hover:shadow-sm ${pendingUsers > 0 ? 'border-blue-200 bg-blue-50/60 hover:bg-blue-50' : 'border-gray-100 bg-gray-50/60'}`}>
            <p className="text-2xl font-bold text-gray-900">{pendingUsers}</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Unactivated users</p>
            {pendingUsers > 0 && <p className="text-[11px] text-blue-600 mt-1">Awaiting approval</p>}
          </Link>
          <Link href="/admin/tenants" className={`rounded-xl border p-4 transition-all hover:shadow-sm ${inactiveTenants > 0 ? 'border-orange-200 bg-orange-50/60 hover:bg-orange-50' : 'border-gray-100 bg-gray-50/60'}`}>
            <p className="text-2xl font-bold text-gray-900">{inactiveTenants}</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Inactive tenants</p>
            {inactiveTenants > 0 && <p className="text-[11px] text-orange-600 mt-1">Subscription lapsed</p>}
          </Link>
          <Link href="/admin/logs" className={`rounded-xl border p-4 transition-all hover:shadow-sm ${messageFailure24h > 0 ? 'border-red-200 bg-red-50/60 hover:bg-red-50' : 'border-gray-100 bg-gray-50/60'}`}>
            <p className="text-2xl font-bold text-gray-900">{messageFailure24h}</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">Msg failures (24h)</p>
            {messageFailure24h > 0 && <p className="text-[11px] text-red-600 mt-1">Check delivery</p>}
          </Link>
        </div>
      </div>

      {/* Recent Tenants Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Recent Tenants</h2>
            <p className="text-xs text-gray-400 mt-0.5">Latest organisations to join</p>
          </div>
          <Link
            href="/admin/tenants"
            className="text-xs font-semibold text-[#0D4B4B] hover:text-[#0D4B4B] flex items-center gap-1 transition-colors"
          >
            View all <ChevronRight size={14} />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Organisation</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Plan</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Users</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tenants.slice(0, 5).map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-[#0D4B4B]/5 flex items-center justify-center text-[#0D4B4B]">
                        <Building2 size={15} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{tenant.name}</p>
                        <p className="text-[11px] text-gray-400 font-mono">{tenant.subdomain}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                      {tenant.plan}
                    </span>
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
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Users size={13} className="text-gray-400" />
                      {tenant.users.length}
                    </div>
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <Link
                      href={`/admin/tenants/${tenant.id}`}
                      className="text-xs font-semibold text-[#0D4B4B] hover:text-[#0D4B4B] transition-colors"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                        <Building2 size={24} className="text-gray-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">No tenants yet</p>
                        <p className="text-xs text-gray-400 mt-1">Create your first organisation to get started</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
