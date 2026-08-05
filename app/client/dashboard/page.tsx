import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Sparkles } from 'lucide-react';
import DashboardContent from './DashboardContent';

export default async function ClientDashboard() {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');
  if (!['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) redirect('/login');

  const tenantId = (session.user as any).tenantId;

  if (!tenantId) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 font-['DM_Sans']">
        <div className="bg-white rounded-3xl p-10 max-w-md w-full text-center shadow-lg border border-gray-100">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#FF6B35] to-[#F7931E] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/25">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="font-serif text-2xl font-black text-gray-900 mb-2">Welcome, {session.user.name}</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            You are logged in as <strong className="text-[#FF6B35]">{(session.user as any).role}</strong>.<br />
            No organisation is linked to this account.
          </p>
        </div>
      </div>
    );
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