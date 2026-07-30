import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { Building2, Users, CreditCard, UserCheck, Activity, ArrowUp, ArrowDown } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== 'SUPER_ADMIN') redirect('/login');

  const [tenants, pendingUsers, totalStaff, totalCredits] = await Promise.all([
    prisma.tenant.findMany({ include: { users: true }, orderBy: { createdAt: 'desc' } }),
    prisma.user.count({ where: { isActive: false, role: 'CLIENT' } }),
    prisma.user.count({ where: { role: 'STAFF' } }),
    prisma.tenant.aggregate({ _sum: { credits: true } }),
  ]);

  const stats = [
    { label: 'Total Tenants', value: tenants.length, icon: Building2, color: '#0D4F4F', change: '+12%', trend: 'up' },
    { label: 'Active Subscriptions', value: tenants.filter(t => t.subscriptionStatus === 'active').length, icon: CreditCard, color: '#1A7A4A', change: '+8%', trend: 'up' },
    { label: 'Total Users', value: tenants.reduce((acc, t) => acc + t.users.length, 0), icon: Users, color: '#C07A20', change: '+5%', trend: 'up' },
    { label: 'Pending Approvals', value: pendingUsers, icon: UserCheck, color: '#C0392B', change: pendingUsers > 0 ? `${pendingUsers} waiting` : 'All clear', trend: pendingUsers > 0 ? 'down' : 'up' },
    { label: 'Staff Members', value: totalStaff, icon: Users, color: '#4A6072' },
    { label: 'System Credits', value: totalCredits._sum?.credits ?? 0, icon: CreditCard, color: '#0D4F4F' },
  ];

  return (
    <div>
      {/* Header with stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{stat.label}</p>
                <p className="font-serif text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
                {stat.change && (
                  <p className={`text-xs font-medium mt-1 flex items-center gap-1 ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                    {stat.trend === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                    {stat.change}
                  </p>
                )}
              </div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(13,79,79,0.08)', color: stat.color }}>
                <stat.icon size={20} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Link href="/admin/tenants/new" className="bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white rounded-2xl p-5 shadow-md hover:shadow-lg transition text-center">
          <Building2 size={24} className="mx-auto mb-2" />
          <p className="font-bold text-sm">Create New Tenant</p>
          <p className="text-xs opacity-75">Add a new organisation</p>
        </Link>
        <Link href="/admin/users" className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition text-center">
          <Users size={24} className="mx-auto mb-2 text-[#0D4F4F]" />
          <p className="font-bold text-sm text-gray-800">Manage Users</p>
          <p className="text-xs text-gray-400">Activate or deactivate accounts</p>
        </Link>
        <Link href="/admin/staff" className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition text-center">
          <UserCheck size={24} className="mx-auto mb-2 text-[#0D4F4F]" />
          <p className="font-bold text-sm text-gray-800">Staff Management</p>
          <p className="text-xs text-gray-400">View all staff members</p>
        </Link>
      </div>

      {/* Recent Tenants Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-serif text-lg font-bold text-gray-800">Recent Organisations</h2>
          <Link href="/admin/tenants" className="text-sm font-bold text-[#0D4F4F] hover:underline">
            View All →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#FAFBFD] border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Users</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tenants.slice(0, 5).map((tenant) => (
                <tr key={tenant.id} className="border-b border-gray-100 hover:bg-gray-50 transition">
                  <td className="px-4 py-3 font-semibold text-sm">{tenant.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{tenant.plan}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                      tenant.subscriptionStatus === 'active' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {tenant.subscriptionStatus === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">{tenant.users.length}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/tenants/${tenant.id}/manage`} className="text-sm font-bold text-[#0D4F4F] hover:underline">
                      Manage →
                    </Link>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No organisations created yet.
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