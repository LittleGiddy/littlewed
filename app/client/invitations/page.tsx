import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function InvitationsPage() {
  const session = await getServerSession();
  if (!session || (session.user as any).role !== 'CLIENT') redirect('/login');
  const tenantId = (session.user as any).tenantId;
  const events = await prisma.event.findMany({
    where: { tenantId },
    select: { id: true, name: true, date: true },
    orderBy: { date: 'desc' },
  });
  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      <h1 className="text-2xl font-bold mb-4">Invitations</h1>
      <p className="text-gray-500 mb-6">Select an event to design or send invitations.</p>
      <div className="space-y-3">
        {events.map(event => (
          <div key={event.id} className="bg-white rounded-xl shadow p-4 flex justify-between items-center">
            <div>
              <h2 className="font-semibold">{event.name}</h2>
              <p className="text-sm text-gray-500">{new Date(event.date).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-2">
              <Link href={`/client/invitations/design/${event.id}`} className="text-indigo-600 text-sm">Design</Link>
              <span className="text-gray-300">|</span>
              <Link href={`/client/invitations/send/${event.id}`} className="text-green-600 text-sm">Send</Link>
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="text-center text-gray-500">No events yet. Create an event first.</p>}
      </div>
    </div>
  );
}