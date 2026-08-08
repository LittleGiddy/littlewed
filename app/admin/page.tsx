import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { 
  Building2, Users, CreditCard, UserCheck, Activity, 
  ArrowUp, ArrowDown, TrendingUp, Calendar, Clock,
  ChevronRight, PlusCircle, ExternalLink, Zap
} from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== 'SUPER_ADMIN') redirect('/login');

  const [tenants, pendingUsers, totalStaff, totalCredits] = await Promise.all([
    prisma.tenant.findMany({ 
      include: { users: true }, 
      orderBy: { createdAt: 'desc' } 
    }),
    prisma.user.count({ where: { isActive: false, role: 'CLIENT' } }),
    prisma.user.count({ where: { role: 'STAFF' } }),
    prisma.tenant.aggregate({ _sum: { credits: true } }),
  ]);

  const activeSubscriptions = tenants.filter(t => t.subscriptionStatus === 'active').length;
  const totalUsers = tenants.reduce((acc, t) => acc + t.users.length, 0);
  const totalCreditsSum = totalCredits._sum?.credits ?? 0;

  const stats = [
    { 
      label: 'Total Tenants', 
      value: tenants.length, 
      icon: Building2, 
      color: '#0D4F4F', 
      bg: '#E8F4F4',
      change: '+12%', 
      trend: 'up' 
    },
    { 
      label: 'Active Subscriptions', 
      value: activeSubscriptions, 
      icon: CreditCard, 
      color: '#1A7A4A', 
      bg: '#E6F7F1',
      change: '+8%', 
      trend: 'up' 
    },
    { 
      label: 'Total Users', 
      value: totalUsers, 
      icon: Users, 
      color: '#C07A20', 
      bg: '#FFF4E8',
      change: '+5%', 
      trend: 'up' 
    },
    { 
      label: 'Pending Approvals', 
      value: pendingUsers, 
      icon: UserCheck, 
      color: '#DC2626', 
      bg: '#FEE8E8',
      change: pendingUsers > 0 ? `${pendingUsers} waiting` : 'All clear', 
      trend: pendingUsers > 0 ? 'down' : 'up' 
    },
    { 
      label: 'Staff Members', 
      value: totalStaff, 
      icon: Users, 
      color: '#6366F1', 
      bg: '#EEF2FF' 
    },
    { 
      label: 'System Credits', 
      value: totalCreditsSum, 
      icon: CreditCard, 
      color: '#0D4F4F', 
      bg: '#E8F4F4' 
    },
  ];

  return (
    <div className="space-y-8">
      {/* ─── Page Header ─── */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#0D1B1B]">Dashboard</h1>
            <p className="text-sm text-[#64748B] mt-1">Overview of your entire platform</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#64748B] bg-white px-4 py-2 rounded-xl border border-[#EEF2F6] shadow-sm flex items-center gap-2">
              <Clock size={14} className="text-[#94A3B8]" />
              Last updated: {new Date().toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Stats Grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {stats.map((stat) => (
          <div 
            key={stat.label} 
            className="bg-white rounded-2xl border border-[#EEF2F6] p-5 shadow-sm hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-xs font-medium text-[#94A3B8] uppercase tracking-wider">
                  {stat.label}
                </p>
                <p className="text-2xl font-bold text-[#0D1B1B] tracking-tight">
                  {stat.value}
                </p>
                {stat.change && (
                  <p className={`text-xs font-medium flex items-center gap-1 ${
                    stat.trend === 'up' ? 'text-[#1A7A4A]' : 'text-[#DC2626]'
                  }`}>
                    {stat.trend === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    {stat.change}
                  </p>
                )}
              </div>
              <div 
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: stat.bg, color: stat.color }}
              >
                <stat.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Quick Actions ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link 
          href="/admin/tenants/new" 
          className="group bg-gradient-to-r from-[#0D4F4F] to-[#1A6B6B] rounded-2xl p-5 shadow-md hover:shadow-lg transition-all duration-200 text-white hover:scale-[1.02]"
        >
          <div className="flex items-center justify-between">
            <div>
              <Building2 size={24} className="mb-2 opacity-90" />
              <p className="font-semibold text-sm">Create New Tenant</p>
              <p className="text-xs opacity-75 mt-0.5">Add a new organisation</p>
            </div>
            <ChevronRight size={20} className="opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </div>
        </Link>
        <Link 
          href="/admin/users" 
          className="group bg-white border border-[#EEF2F6] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between">
            <div>
              <Users size={24} className="mb-2 text-[#0D4F4F]" />
              <p className="font-semibold text-sm text-[#0D1B1B]">Manage Users</p>
              <p className="text-xs text-[#64748B] mt-0.5">Activate or deactivate accounts</p>
            </div>
            <ChevronRight size={20} className="text-[#94A3B8]" />
          </div>
        </Link>
        <Link 
          href="/admin/staff" 
          className="group bg-white border border-[#EEF2F6] rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.01]"
        >
          <div className="flex items-center justify-between">
            <div>
              <UserCheck size={24} className="mb-2 text-[#6366F1]" />
              <p className="font-semibold text-sm text-[#0D1B1B]">Staff Management</p>
              <p className="text-xs text-[#64748B] mt-0.5">View all staff members</p>
            </div>
            <ChevronRight size={20} className="text-[#94A3B8]" />
          </div>
        </Link>
      </div>

      {/* ─── Recent Tenants Table ─── */}
      <div className="bg-white rounded-2xl border border-[#EEF2F6] shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EEF2F6] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 size={18} className="text-[#0D4F4F]" />
            <h2 className="font-semibold text-[#0D1B1B]">Recent Organisations</h2>
            <span className="text-xs font-medium text-[#64748B] bg-[#F1F5F9] px-2 py-0.5 rounded-full">
              {tenants.length}
            </span>
          </div>
          <Link 
            href="/admin/tenants" 
            className="text-sm font-medium text-[#0D4F4F] hover:underline flex items-center gap-1"
          >
            View All
            <ChevronRight size={14} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F8FAFC] border-b border-[#EEF2F6]">
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                  Organisation
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                  Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-[#64748B] uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {tenants.slice(0, 5).map((tenant) => (
                <tr key={tenant.id} className="hover:bg-[#F8FAFC] transition-colors">
                  <td className="px-6 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#E8F4F4] flex items-center justify-center text-[#0D4F4F]">
                        <Building2 size={14} />
                      </div>
                      <span className="font-medium text-sm text-[#0D1B1B]">{tenant.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="text-xs font-medium text-[#64748B] bg-[#F1F5F9] px-2.5 py-1 rounded-full">
                      {tenant.plan}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                      tenant.subscriptionStatus === 'active' 
                        ? 'bg-[#E6F7F1] text-[#1A7A4A]' 
                        : 'bg-[#FEE8E8] text-[#DC2626]'
                    }`}>
                      {tenant.subscriptionStatus === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-sm text-[#64748B]">
                    {tenant.users.length}
                  </td>
                  <td className="px-6 py-3.5">
                    <Link 
                      href={`/admin/tenants/${tenant.id}/manage`} 
                      className="text-sm font-medium text-[#0D4F4F] hover:underline flex items-center gap-1"
                    >
                      Manage
                      <ExternalLink size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-[#94A3B8]">
                    <div className="flex flex-col items-center gap-2">
                      <Building2 size={32} className="text-[#CBD5E1]" />
                      <p className="text-sm font-medium">No organisations created yet</p>
                      <p className="text-xs">Create your first tenant to get started</p>
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