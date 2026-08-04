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
      <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center p-6 font-['DM_Sans']">
        <div className="bg-white rounded-3xl p-12 max-w-md w-full text-center shadow-xl border border-gray-100">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#0D4F4F] to-[#0A3D3D] flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="font-serif text-2xl font-black text-gray-900 mb-2">Welcome, {session.user.name}</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            You are logged in as <strong className="text-[#0D4F4F]">{(session.user as any).role}</strong>.<br />
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

  // ✅ Transform events to match the expected shape in DashboardContent
  const transformedEvents = events.map((event) => ({
    id: event.id,
    name: event.name,
    date: event.date.toISOString(), // Date → string
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
      events={transformedEvents} // ✅ Pass transformed events
      newEventUrl={newEventUrl}
    />
  );
}