import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import DashboardContent from './DashboardContent';

export default async function ClientDashboard() {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');
  if (!['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) redirect('/login');

  const tenantId = (session.user as any).tenantId;

  if (!tenantId) {
    // No dead end — send them to finish account setup (org creation).
    // This is the same page Google sign-in/sign-up routes through, so it
    // works whether they got here via Google or somehow via credentials
    // with a missing tenant.
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
    take: 5,
  });

  const transformedEvents = events.map((event) => ({
    id: event.id,
    name: event.name,
    date: event.date.toISOString(),
    venue: event.venue,
    _count: { guests: event._count.guests },
  }));

  const simpleEventMode = tenant?.simpleEventMode ?? false;
  const newEventUrl = simpleEventMode ? '/client/events/new-simple' : '/client/events/new';

  const totalGuests = await prisma.guest.count({ where: { event: { tenantId } } });
  const checkedIn = await prisma.guest.count({ where: { event: { tenantId }, checkedIn: true } });

  const firstName = session.user.name?.split(' ')[0] ?? 'there';

  return (
    <DashboardContent
      firstName={firstName}
      credits={tenant?.credits ?? 0}
      totalGuests={totalGuests}
      checkedIn={checkedIn}
      events={transformedEvents}
      newEventUrl={newEventUrl}
    />
  );
}