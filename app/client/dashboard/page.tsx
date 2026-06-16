import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Calendar, Users, QrCode, ArrowRight, Plus, Coins } from 'lucide-react';
import Link from 'next/link';
import DeleteEventButton from '@/components/DeleteEventButton';

export default async function ClientDashboard() {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');
  if (!['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) redirect('/login');

  const tenantId = (session.user as any).tenantId;

  if (!tenantId) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F0F4F8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif", padding: '24px',
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800&display=swap');`}</style>
        <div style={{
          background: 'white', borderRadius: 24, padding: '48px 40px',
          maxWidth: 420, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: 'linear-gradient(135deg, #0D4F4F, #0A3D3D)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', fontSize: 28,
          }}>💍</div>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 800, color: '#0D1B1B', marginBottom: 8 }}>
            Welcome, {session.user.name}
          </h1>
          <p style={{ color: '#7A8FA6', fontSize: 14, lineHeight: 1.6 }}>
            You are logged in as <strong style={{ color: '#0D4F4F' }}>{(session.user as any).role}</strong>.<br />
            No organisation is linked to this account.
          </p>
        </div>
      </div>
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, simpleEventMode: true },
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
    { label: 'Amount Paid (TZS)', value: amountPaid.toLocaleString(), icon: Coins,    bg: '#FEF9E6', color: '#C07A20' },
    { label: 'Total Guests',      value: totalGuests,                  icon: Users,    bg: '#EAF4F4', color: '#0D4F4F' },
    { label: 'Checked In',        value: checkedIn,                    icon: QrCode,   bg: '#EDFAF4', color: '#1A7A4A' },
    { label: 'Events',            value: events.length,                icon: Calendar, bg: '#F3EEFA', color: '#6B3FA0' },
  ];

  const firstName = session.user.name?.split(' ')[0] ?? 'there';

  return (
    <div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        /* ── Header ── */
        .dash-header {
          display: flex; align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 28px; gap: 16px;
        }

        .dash-greeting {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          text-transform: uppercase; color: #0D4F4F;
          margin-bottom: 6px;
          display: flex; align-items: center; gap: 7px;
        }
        .dash-greeting-dot { width: 5px; height: 5px; border-radius: 50%; background: #E8A598; }

        .dash-title {
          font-family: 'Playfair Display', serif;
          font-size: 32px; font-weight: 900; color: #0D1B1B;
          line-height: 1.1; letter-spacing: -0.5px; margin: 0;
        }
        .dash-title span { color: #E8A598; }

        .dash-sub { color: #7A8FA6; font-size: 14px; margin-top: 6px; font-weight: 400; }

        .create-btn {
          display: flex; align-items: center; gap: 7px;
          padding: 12px 20px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 14px; font-weight: 700;
          font-family: inherit; border: none; border-radius: 14px;
          text-decoration: none; white-space: nowrap; flex-shrink: 0;
          box-shadow: 0 4px 16px rgba(13,79,79,0.35);
          transition: transform 0.15s, box-shadow 0.15s;
          align-self: flex-start;
        }
        .create-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(13,79,79,0.4); }
        .create-btn:active { transform: translateY(0); }

        /* ── Stats ── */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 14px; margin-bottom: 28px;
        }

        .stat-card {
          background: white; border-radius: 20px; padding: 20px 16px;
          border: 1.5px solid #F0F4F8;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          transition: transform 0.2s, box-shadow 0.2s;
          animation: cardPop 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.1); }

        @keyframes cardPop {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .stat-icon-wrap {
          width: 40px; height: 40px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          margin-bottom: 14px;
        }

        .stat-value {
          font-family: 'Playfair Display', serif;
          font-size: 26px; font-weight: 900; color: #0D1B1B;
          line-height: 1; margin-bottom: 4px; letter-spacing: -0.5px;
          /* prevent long numbers overflowing */
          word-break: break-all;
        }

        .stat-label { font-size: 11.5px; color: #9BAAB8; font-weight: 600; letter-spacing: 0.2px; }

        /* ── Events section ── */
        .section-card {
          background: white; border-radius: 20px; overflow: hidden;
          border: 1.5px solid #F0F4F8;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          animation: cardPop 0.5s 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }

        .section-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 22px; border-bottom: 1.5px solid #F0F4F8;
        }

        .section-title {
          font-family: 'Playfair Display', serif;
          font-size: 17px; font-weight: 800; color: #0D1B1B; letter-spacing: -0.2px;
        }

        .section-badge {
          font-size: 11px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.08); border: 1px solid rgba(13,79,79,0.12);
          padding: 3px 10px; border-radius: 20px;
        }

        /* ── Event row ── */
        .event-row {
          display: flex; align-items: center; gap: 14px;
          padding: 15px 22px; text-decoration: none;
          border-bottom: 1px solid #F7F9FB;
          transition: background 0.15s;
          position: relative;
        }
        .event-row:last-child { border-bottom: none; }
        .event-row:hover { background: #F7FAFA; }
        .event-row:hover .event-arrow { color: #0D4F4F; transform: translateX(3px); }

        /* Left accent on hover */
        .event-row::before {
          content: '';
          position: absolute; left: 0; top: 20%; bottom: 20%;
          width: 3px; border-radius: 0 2px 2px 0;
          background: linear-gradient(180deg, #0D4F4F, #E8A598);
          opacity: 0; transition: opacity 0.2s;
        }
        .event-row:hover::before { opacity: 1; }

        .event-date-box {
          width: 44px; height: 44px; border-radius: 12px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          flex-shrink: 0; color: white;
        }
        .event-date-day {
          font-size: 16px; font-weight: 800; line-height: 1;
          font-family: 'Playfair Display', serif;
        }
        .event-date-mon {
          font-size: 9px; font-weight: 700; letter-spacing: 0.5px;
          text-transform: uppercase; opacity: 0.8; margin-top: 1px;
        }

        /* Info block — grows to fill available space */
        .event-info { flex: 1 1 0; min-width: 0; }

        .event-name {
          font-size: 14px; font-weight: 700; color: #0D1B1B;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-bottom: 3px;
        }
        .event-meta {
          font-size: 12px; color: #9BAAB8; font-weight: 500;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        /* Right-side controls — fixed, never shrink */
        .event-actions {
          display: flex; align-items: center; gap: 8px; flex-shrink: 0;
        }

        .event-guests-badge {
          font-size: 11.5px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.07); padding: 4px 10px;
          border-radius: 20px; white-space: nowrap;
        }

        .event-arrow {
          color: #C8D4DE; flex-shrink: 0;
          transition: color 0.15s, transform 0.15s;
        }

        /* ── Empty state ── */
        .empty-state { padding: 56px 24px; text-align: center; }
        .empty-icon {
          width: 60px; height: 60px; border-radius: 18px;
          background: rgba(13,79,79,0.07);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px; font-size: 26px;
        }
        .empty-title {
          font-family: 'Playfair Display', serif;
          font-size: 18px; font-weight: 800; color: #0D1B1B; margin-bottom: 6px;
        }
        .empty-sub { font-size: 13.5px; color: #9BAAB8; line-height: 1.6; }
        .empty-btn {
          display: inline-flex; align-items: center; gap: 6px;
          margin-top: 20px; padding: 11px 20px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 13.5px; font-weight: 700;
          font-family: inherit; text-decoration: none;
          border-radius: 12px; box-shadow: 0 4px 12px rgba(13,79,79,0.3);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .empty-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(13,79,79,0.35); }

        /* ── Responsive ── */

        /* Tablet: 2-col stats */
        @media (max-width: 860px) {
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
        }

        /* Mobile */
        @media (max-width: 600px) {
          .dash-title { font-size: 26px; }
          .dash-sub { font-size: 13px; }

          /* Icon-only create button */
          .create-btn-label { display: none; }
          .create-btn { padding: 11px 13px; }

          /* 2-col stats stay, just tighter */
          .stats-grid { gap: 10px; margin-bottom: 20px; }
          .stat-card { padding: 16px 14px; }
          .stat-value { font-size: 22px; }
          .stat-label { font-size: 11px; }

          /* Event row: stack info + controls vertically */
          .event-row { padding: 14px 16px; gap: 12px; }
          .section-header { padding: 14px 16px; }

          /* Hide guest badge on very small screens, show as part of meta */
          .event-guests-badge { display: none; }

          /* Show guest count inside meta line instead */
          .event-meta-guests { display: inline; }
        }

        @media (min-width: 601px) {
          .event-meta-guests { display: none; }
        }
      `}</style>

      {/* Header */}
      <div className="dash-header">
        <div>
          <div className="dash-greeting">
            <div className="dash-greeting-dot" />
            Your Dashboard
          </div>
          <div className="dash-title">
            Hello, <span>{firstName}.</span>
          </div>
          <p className="dash-sub">Here's what's happening with your events today.</p>
        </div>
        <Link href={newEventUrl} className="create-btn">
          <Plus size={15} />
          <span className="create-btn-label">New Event</span>
        </Link>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {stats.map(({ label, value, icon: Icon, bg, color }, i) => (
          <div key={label} className="stat-card" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="stat-icon-wrap" style={{ background: bg }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div className="stat-value">{value}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Events */}
      <div className="section-card">
        <div className="section-header">
          <div className="section-title">Upcoming Events</div>
          <div className="section-badge">{events.length} event{events.length !== 1 ? 's' : ''}</div>
        </div>

        {events.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🎊</div>
            <div className="empty-title">No events yet</div>
            <p className="empty-sub">Create your first event and start<br />managing guests and invitations.</p>
            <Link href={newEventUrl} className="empty-btn">
              <Plus size={14} /> Create your first event
            </Link>
          </div>
        ) : (
          events.map((event) => {
            const d = new Date(event.date);
            const day = d.getDate();
            const mon = d.toLocaleString('default', { month: 'short' });
            return (
              <div key={event.id} className="event-row">
                {/* Date box */}
                <div className="event-date-box">
                  <div className="event-date-day">{day}</div>
                  <div className="event-date-mon">{mon}</div>
                </div>

                {/* Name + venue (links to event page) */}
                <Link
                  href={`/client/events/${event.id}`}
                  style={{ flex: '1 1 0', minWidth: 0, textDecoration: 'none' }}
                >
                  <div className="event-info">
                    <div className="event-name">{event.name}</div>
                    <div className="event-meta">
                      {event.venue}
                      {/* Guest count shown inline on mobile */}
                      <span className="event-meta-guests">
                        {event.venue ? ' · ' : ''}{event._count.guests} guests
                      </span>
                    </div>
                  </div>
                </Link>

                {/* Right-side controls — fixed, never overlap */}
                <div className="event-actions">
                  <span className="event-guests-badge">{event._count.guests} guests</span>
                  <DeleteEventButton eventId={event.id} />
                  <Link href={`/client/events/${event.id}`} style={{ display: 'flex' }}>
                    <ArrowRight size={15} className="event-arrow" />
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}