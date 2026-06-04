import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { authOptions } from '@/lib/auth';

export default async function GuestsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');

  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return <div className="p-4">No organisation linked to your account.</div>;
  }

  const events = await prisma.event.findMany({
    where: { tenantId },
    select: { id: true, name: true },
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Guest Management</h1>
      <div className="bg-white rounded-lg shadow p-6">
        <p className="text-gray-600 mb-4">Select an event to manage guests:</p>
        <div className="space-y-2">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/guests/${event.id}`}
              className="block p-3 border rounded hover:bg-gray-50"
            >
              {event.name}
            </Link>
          ))}
          {events.length === 0 && (
            <p className="text-gray-500">
              No events yet. <Link href="/events/new" className="text-blue-600">Create one</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}