import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import RsvpWishesClient from './RsvpWishesClient';

export default async function EventRsvpsPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center text-gray-500">
        Please log in to view this event.
      </div>
    );
  }

  const role = (session.user as { role?: string } | undefined)?.role;
  const tenantId = (session.user as { tenantId?: string } | undefined)?.tenantId;
  if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') redirect('/login');

  const { id: eventId } = await params;

  const event = await prisma.event.findFirst({
    where: { id: eventId, tenantId },
    include: {
      rsvps: {
        where: { isCurrent: true },
        select: { id: true, guestId: true, guestName: true, status: true, channel: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      },
      wishes: {
        // Same rule as the invitee page: only wishes a guest actually wrote.
        // Rows with no guestId are seeded placeholders, not real messages.
        where: { guestId: { not: null } },
        select: { id: true, guestId: true, guestName: true, message: true, attending: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 500,
      },
    },
  });

  if (!event) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-card shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Event Not Found</h1>
          <p className="text-gray-500 mb-4">This event doesn&apos;t exist or you don&apos;t have access to it.</p>
          <Link href="/client/dashboard" className="inline-block text-brandtext font-semibold hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <RsvpWishesClient
      event={{
        id: event.id,
        name: event.name,
        date: event.date.toISOString(),
        venue: event.venue,
      }}
      rsvps={event.rsvps.map(r => ({
        id: r.id,
        guestName: r.guestName,
        status: r.status,
        channel: r.channel,
        createdAt: r.createdAt.toISOString(),
      }))}
      wishes={event.wishes.map(w => ({
        id: w.id,
        guestId: w.guestId,
        guestName: w.guestName,
        message: w.message,
        attending: w.attending,
        createdAt: w.createdAt.toISOString(),
      }))}
    />
  );
}
