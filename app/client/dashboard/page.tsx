import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Calendar, Users, QrCode, ArrowRight, Plus, Coins } from 'lucide-react';
import Link from 'next/link';
import DeleteEventButton from '@/components/DeleteEventButton';
import Head from 'next/head';
import BuyCreditsButton from '@/app/components/BuyCreditsButton';

export default async function ClientDashboard() {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');
  if (!['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) redirect('/login');

  const tenantId = (session.user as any).tenantId;

  // Handle missing tenant
  if (!tenantId) {
    return (
      <div className="min-h-screen bg-[#F0F4F8] flex items-center justify-center p-6 font-sans">
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        </Head>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800&display=swap');`}</style>
        <div className="bg-white rounded-2xl p-12 max-w-md w-full text-center shadow-lg">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0D4F4F] to-[#0A3D3D] flex items-center justify-center mx-auto mb-5 text-3xl">
            💍
          </div>
          <h1 className="font-serif text-2xl font-extrabold text-[#0D1B1B] mb-2">
            Welcome, {session.user.name}
          </h1>
          <p className="text-[#7A8FA6] text-sm">
            You are logged in as <strong className="text-[#0D4F4F]">{(session.user as any).role}</strong>.<br />
            No organisation is linked to this account.
          </p>
        </div>
      </div>
    );
  }

  // ✅ Fetch tenant with credits
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

  const simpleEventMode = tenant?.simpleEventMode ?? false;
  const newEventUrl = simpleEventMode ? '/client/events/new-simple' : '/client/events/new';

  const totalGuests = await prisma.guest.count({ where: { event: { tenantId } } });
  const checkedIn = await prisma.guest.count({ where: { event: { tenantId }, checkedIn: true } });
  const amountPaidResult = await prisma.event.aggregate({
    where: { tenantId, commission_paid: true },
    _sum: { total_budget: true },
  });
  const amountPaid = amountPaidResult._sum.total_budget ?? 0;

  const stats = [
    { label: 'Available Credits', value: tenant?.credits ?? 0, icon: Coins, bg: '#FEF9E6', color: '#C07A20' },
    { label: 'Total Guests', value: totalGuests, icon: Users, bg: '#EAF4F4', color: '#0D4F4F' },
    { label: 'Checked In', value: checkedIn, icon: QrCode, bg: '#EDFAF4', color: '#1A7A4A' },
    { label: 'Events', value: events.length, icon: Calendar, bg: '#F3EEFA', color: '#6B3FA0' },
  ];

  const firstName = session.user.name?.split(' ')[0] ?? 'there';

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=yes" />
      </Head>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');

          .dash-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            margin-bottom: 32px;
            gap: 16px;
            flex-wrap: wrap;
          }

          .dash-greeting {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: #0D4F4F;
            margin-bottom: 6px;
          }

          .dash-title {
            font-family: 'Playfair Display', serif;
            font-size: 32px;
            font-weight: 900;
            color: #0D1B1B;
            line-height: 1.1;
            letter-spacing: -0.5px;
          }

          .dash-title span { color: #E8A598; }

          .dash-sub {
            color: #7A8FA6;
            font-size: 14px;
            margin-top: 6px;
            font-weight: 400;
          }

          .create-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 12px 24px;
            background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
            color: white;
            font-size: 14px;
            font-weight: 700;
            border-radius: 14px;
            text-decoration: none;
            box-shadow: 0 4px 12px rgba(13, 79, 79, 0.3);
            transition: transform 0.15s, box-shadow 0.15s;
            white-space: nowrap;
          }
          .create-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(13, 79, 79, 0.35);
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
          }

          .stat-card {
            background: white;
            border-radius: 20px;
            padding: 20px 16px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
            transition: transform 0.2s, box-shadow 0.2s;
            animation: cardPop 0.5s cubic-bezier(0.16,1,0.3,1) both;
          }
          .stat-card:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          }

          @keyframes cardPop {
            from { opacity: 0; transform: translateY(12px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }

          .stat-icon-wrap {
            width: 44px;
            height: 44px;
            border-radius: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 14px;
          }

          .stat-value {
            font-family: 'Playfair Display', serif;
            font-size: 32px;
            font-weight: 900;
            color: #0D1B1B;
            line-height: 1;
            margin-bottom: 6px;
            letter-spacing: -0.5px;
          }

          .stat-label {
            font-size: 12px;
            color: #9BAAB8;
            font-weight: 600;
            letter-spacing: 0.2px;
          }

          /* ✅ New credits action row */
          .credits-action-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: white;
            border-radius: 20px;
            padding: 16px 24px;
            margin-bottom: 32px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
            animation: cardPop 0.5s cubic-bezier(0.16,1,0.3,1) both;
          }

          .credits-action-label {
            font-size: 14px;
            color: #7A8FA6;
          }
          .credits-action-value {
            font-family: 'Playfair Display', serif;
            font-size: 28px;
            font-weight: 900;
            color: #0D4F4F;
          }

          .section-card {
            background: white;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
            animation: cardPop 0.5s 0.25s cubic-bezier(0.16,1,0.3,1) both;
          }

          .section-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 18px 24px;
            border-bottom: 1.5px solid #F0F4F8;
          }

          .section-title {
            font-family: 'Playfair Display', serif;
            font-size: 18px;
            font-weight: 800;
            color: #0D1B1B;
            letter-spacing: -0.2px;
          }

          .section-badge {
            font-size: 11px;
            font-weight: 700;
            color: #0D4F4F;
            background: rgba(13, 79, 79, 0.08);
            border: 1px solid rgba(13, 79, 79, 0.12);
            padding: 4px 12px;
            border-radius: 30px;
          }

          .event-row {
            display: flex;
            align-items: center;
            gap: 16px;
            padding: 16px 24px;
            text-decoration: none;
            border-bottom: 1px solid #F7F9FB;
            transition: background 0.15s;
          }
          .event-row:last-child { border-bottom: none; }
          .event-row:hover { background: #F7FAFA; }

          .event-date-box {
            width: 48px;
            height: 48px;
            border-radius: 14px;
            background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
            color: white;
          }

          .event-date-day {
            font-size: 18px;
            font-weight: 800;
            line-height: 1;
            font-family: 'Playfair Display', serif;
          }

          .event-date-mon {
            font-size: 9px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            opacity: 0.85;
            margin-top: 2px;
          }

          .event-info { flex: 1; min-width: 0; }

          .event-name {
            font-size: 15px;
            font-weight: 700;
            color: #0D1B1B;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .event-meta {
            font-size: 12px;
            color: #9BAAB8;
            margin-top: 4px;
            font-weight: 500;
          }

          .event-guests-badge {
            font-size: 12px;
            font-weight: 700;
            color: #0D4F4F;
            background: rgba(13, 79, 79, 0.07);
            padding: 5px 12px;
            border-radius: 30px;
            flex-shrink: 0;
          }

          .event-arrow {
            color: #C8D4DE;
            flex-shrink: 0;
            transition: color 0.15s, transform 0.15s;
          }
          .event-row:hover .event-arrow {
            color: #0D4F4F;
            transform: translateX(3px);
          }

          .empty-state {
            padding: 64px 24px;
            text-align: center;
          }

          .empty-icon {
            width: 72px;
            height: 72px;
            border-radius: 24px;
            background: rgba(13, 79, 79, 0.07);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
            font-size: 32px;
          }

          .empty-title {
            font-family: 'Playfair Display', serif;
            font-size: 20px;
            font-weight: 800;
            color: #0D1B1B;
            margin-bottom: 8px;
          }

          .empty-sub {
            font-size: 14px;
            color: #9BAAB8;
            line-height: 1.6;
          }

          .empty-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 24px;
            padding: 12px 24px;
            background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
            color: white;
            font-size: 14px;
            font-weight: 700;
            text-decoration: none;
            border-radius: 14px;
            box-shadow: 0 4px 12px rgba(13, 79, 79, 0.3);
            transition: transform 0.15s, box-shadow 0.15s;
          }
          .empty-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(13, 79, 79, 0.35);
          }

          @media (max-width: 640px) {
            .dash-title { font-size: 28px; }
            .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
            .stat-value { font-size: 28px; }
            .create-btn span { display: none; }
            .create-btn { padding: 12px 16px; }
            .section-header { padding: 14px 20px; }
            .event-row { padding: 14px 20px; }
            .event-date-box { width: 42px; height: 42px; }
            .event-date-day { font-size: 16px; }
            .credits-action-row { flex-direction: column; gap: 12px; align-items: stretch; text-align: center; }
            .credits-action-value { font-size: 24px; }
          }
        `}</style>

        <div className="dash-header">
          <div>
            <div className="dash-greeting">Your Dashboard</div>
            <div className="dash-title">
              Hello, <span>{firstName}.</span>
            </div>
            <p className="dash-sub">Here's what's happening with your events today.</p>
          </div>
          <Link href={newEventUrl} className="create-btn">
            <Plus size={16} />
            <span>New Event</span>
          </Link>
        </div>

        <div className="stats-grid">
          {stats.map(({ label, value, icon: Icon, bg, color }) => (
            <div key={label} className="stat-card">
              <div className="stat-icon-wrap" style={{ background: bg }}>
                <Icon size={20} style={{ color }} />
              </div>
              <div className="stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>

        {/* ✅ Credits + Buy button */}
        <div className="credits-action-row">
          <div>
            <div className="credits-action-label">Available Credits</div>
            <div className="credits-action-value">{tenant?.credits?.toLocaleString() ?? 0}</div>
          </div>
          <BuyCreditsButton currentCredits={tenant?.credits ?? 0} />
        </div>

        <div className="section-card">
          <div className="section-header">
            <div className="section-title">Upcoming Events</div>
            <div className="section-badge">{events.length} event{events.length !== 1 ? 's' : ''}</div>
          </div>

          {events.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎊</div>
              <div className="empty-title">No events yet</div>
              <p className="empty-sub">Create your first event and start managing guests and invitations.</p>
              <Link href={newEventUrl} className="empty-btn">
                <Plus size={15} /> Create your first event
              </Link>
            </div>
          ) : (
            events.map((event) => {
              const d = new Date(event.date);
              const day = d.getDate();
              const mon = d.toLocaleString('default', { month: 'short' });
              return (
                <Link key={event.id} href={`/client/events/${event.id}`} className="event-row">
                  <div className="event-date-box">
                    <div className="event-date-day">{day}</div>
                    <div className="event-date-mon">{mon}</div>
                  </div>
                  <div className="event-info">
                    <div className="event-name">{event.name}</div>
                    <div className="event-meta">{event.venue}</div>
                  </div>
                  <div className="event-guests-badge">{event._count.guests} guests</div>
                  <DeleteEventButton eventId={event.id} />
                  <ArrowRight size={16} className="event-arrow" />
                </Link>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}