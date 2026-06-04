import { prisma } from '@/lib/prisma';

export default async function SimpleGuestsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  
  // Fetch guests directly from database (server-side)
  const guests = await prisma.guest.findMany({
    where: { eventId },
    select: { id: true, name: true, phone: true, invitationCard: true },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Event ID: {eventId}</h1>
      <h2 className="text-xl mb-2">Guests ({guests.length})</h2>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(guests, null, 2)}
      </pre>
    </div>
  );
}