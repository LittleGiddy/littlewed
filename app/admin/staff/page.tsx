import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';

export default async function AdminStaffPage() {
  const session = await getServerSession();
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') redirect('/login');
  const staff = await prisma.user.findMany({
    where: { role: 'STAFF' },
    include: { tenant: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">All Staff Members</h1>
      <table className="w-full bg-white rounded shadow">
        <thead><tr><th className="p-2 text-left">Name</th><th>Email</th><th>Tenant</th><th>Created</th></tr></thead>
        <tbody>
          {staff.map(s => (
            <tr key={s.id}><td className="p-2">{s.name}</td><td>{s.email}</td><td>{s.tenant?.name || '—'}</td><td>{new Date(s.createdAt).toLocaleDateString()}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}