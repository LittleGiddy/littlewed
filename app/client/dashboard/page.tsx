// app/client/dashboard/page.tsx
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardContent from './DashboardContent';

export default async function ClientDashboard() {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');
  if (!['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) redirect('/login');

  // ✅ Check if user is active - redirect to pending activation if not
  const isActive = (session.user as any).isActive;
  if (!isActive) {
    // Redirect to pending activation page (make sure this path matches your actual file)
    redirect('/client/pending-activation');
  }

  const tenantId = (session.user as any).tenantId;

  if (!tenantId) {
    // Send them to finish account setup (org creation)
    redirect('/auth/google-callback?intent=login');
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, simpleEventMode: true, credits: true },
  });

  const events = await prisma.event.findMany({
    where: { tenantId },
    include: { _count: { select: { guests: true } } },
    orderBy: { date: 'asc' },
  });

  const rsvpCounts = await prisma.rsvp.groupBy({
    by: ['eventId'],
    _count: { id: true },
    where: { event: { tenantId } },
  });
  const rsvpCountMap = new Map(rsvpCounts.map(r => [r.eventId, r._count.id]));

  const transformedEvents = events.map((event) => ({
    id: event.id,
    name: event.name,
    date: event.date.toISOString(),
    venue: event.venue,
    status: event.status,
    _count: { guests: event._count.guests },
    respondedCount: rsvpCountMap.get(event.id) ?? 0,
  }));

  const simpleEventMode = tenant?.simpleEventMode ?? false;
  const newEventUrl = simpleEventMode ? '/client/events/new-simple' : '/client/events/new';

  const totalGuests = await prisma.guest.count({ where: { event: { tenantId } } });
  const checkedIn = await prisma.guest.count({ where: { event: { tenantId }, checkedIn: true } });
  const totalResponded = (await prisma.rsvp.count({ where: { event: { tenantId } } })) as number;

  const firstName = session.user.name?.split(' ')[0] ?? 'there';

  return (
    <DashboardContent
      firstName={firstName}
      credits={tenant?.credits ?? 0}
      totalGuests={totalGuests}
      checkedIn={checkedIn}
      responded={totalResponded}
      events={transformedEvents}
      newEventUrl={newEventUrl}
    />
  );
}