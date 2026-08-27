import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { UserCog, Building2, Mail, Calendar, Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function AdminStaffPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/login');

  const staff = await prisma.user.findMany({
    where: { role: 'STAFF' },
    include: { tenant: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const staffByTenant = staff.reduce((acc, s) => {
    const tenantName = s.tenant?.name || 'Unassigned';
    if (!acc[tenantName]) acc[tenantName] = [];
    acc[tenantName].push(s);
    return acc;
  }, {} as Record<string, typeof staff>);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff Members</h1>
        <p className="text-sm text-gray-500 mt-1">All staff accounts across the platform</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
              <UserCog size={18} className="text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{staff.length}</p>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Staff</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#0D4B4B]/5 flex items-center justify-center">
              <Building2 size={18} className="text-[#0D4B4B]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{Object.keys(staffByTenant).length}</p>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Tenants</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{staffByTenant['Unassigned']?.length || 0}</p>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Unassigned</p>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">All Staff</h2>
          <p className="text-xs text-gray-400 mt-0.5">Staff members and their assigned tenants</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Staff Member</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Tenant</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {staff.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                        <UserCog size={24} className="text-gray-300" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">No staff members</p>
                        <p className="text-xs text-gray-400 mt-1">Staff accounts will appear here</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                staff.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-violet-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {member.name?.charAt(0).toUpperCase() ?? '?'}
                        </div>
                        <span className="text-sm font-semibold text-gray-900">{member.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Mail size={13} className="text-gray-400" />
                        {member.email}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      {member.tenant ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0D4B4B] bg-[#0D4B4B]/5 px-2.5 py-1 rounded-lg">
                          <Building2 size={12} />
                          {member.tenant.name}
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-1.5 text-sm text-gray-500">
                        <Calendar size={13} className="text-gray-400" />
                        {new Date(member.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
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
