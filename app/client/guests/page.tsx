import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';

export default async function GuestsPage() {
  const session = await getServerSession();
  if (!session) redirect('/login');

  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return <div className="p-4">No organisation linked to your account.</div>;
  }

  const events = await prisma.event.findMany({
    where: { tenantId },
    select: { id: true, name: true, date: true },
    orderBy: { date: 'desc' },
  });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Guest Management</h1>
      <p className="text-gray-500 mb-6">Select an event to manage guests:</p>
      <div className="space-y-3">
        {events.map((event) => (
          <Link
            key={event.id}
            href={`/client/guests/${event.id}`}
            className="block bg-white rounded-xl shadow-sm p-4 hover:bg-gray-50 transition"
          >
            <h2 className="font-semibold">{event.name}</h2>
            <p className="text-sm text-gray-500">{new Date(event.date).toLocaleDateString()}</p>
          </Link>
        ))}
        {events.length === 0 && (
          <p className="text-center text-gray-500">No events yet. Create an event first.</p>
        )}
      </div>
    </div>
  );
}