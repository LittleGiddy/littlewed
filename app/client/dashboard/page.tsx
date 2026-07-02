import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Calendar, Users, QrCode, Plus, Coins, Upload, Palette, Send, ArrowRight, Settings, LifeBuoy, BookOpen, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import DeleteEventButton from '@/components/DeleteEventButton';
import BuyCreditsButton from '@/app/components/BuyCreditsButton';

export default async function ClientDashboard() {
  const session = await getServerSession(authOptions);

  if (!session) redirect('/login');
  if (!['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) redirect('/login');

  const tenantId = (session.user as any).tenantId;

  if (!tenantId) {
    return (
      <div style={{ minHeight: '100vh', background: '#F0F4F8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'DM Sans', sans-serif" }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800&display=swap');`}</style>
        <div style={{ background: 'white', borderRadius: 24, padding: '48px 40px', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #0D4F4F, #0A3D3D)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 28 }}>💍</div>
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

  const firstEventId = events.length > 0 ? events[0].id : null;
  const firstName = session.user.name?.split(' ')[0] ?? 'there';

  const stats = [
    { label: 'Credits', value: tenant?.credits ?? 0, icon: Coins, bg: '#FEF9E6', color: '#C07A20' },
    { label: 'Total Guests', value: totalGuests, icon: Users, bg: '#EAF4F4', color: '#0D4F4F' },
    { label: 'Checked In', value: checkedIn, icon: QrCode, bg: '#EDFAF4', color: '#1A7A4A' },
    { label: 'Events', value: events.length, icon: Calendar, bg: '#F3EEFA', color: '#6B3FA0' },
  ];

  return (
    <div className="db-wrap">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .db-wrap {
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          max-width: 1180px; margin: 0 auto;
          padding: 32px 24px 64px;
          animation: dbFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes dbFadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Header ── */
        .db-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 28px; gap: 16px; flex-wrap: wrap;
        }
        .db-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          color: #0D4F4F; text-transform: uppercase; margin-bottom: 6px;
          display: flex; align-items: center; gap: 7px;
        }
        .db-eyebrow-dot { width: 5px; height: 5px; border-radius: 50%; background: #E8A598; }
        .db-title {
          font-family: 'Playfair Display', serif;
          font-size: 32px; font-weight: 900; color: #0D1B1B;
          line-height: 1.1; letter-spacing: -0.5px; margin: 0;
        }
        .db-title span { color: #E8A598; }
        .db-sub { color: #7A8FA6; font-size: 14px; margin-top: 6px; }

        .db-create-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 22px; border: none; border-radius: 14px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 14px; font-weight: 700;
          text-decoration: none; white-space: nowrap;
          box-shadow: 0 4px 14px rgba(13,79,79,0.3);
          transition: transform 0.15s, box-shadow 0.15s;
          align-self: flex-start;
        }
        .db-create-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(13,79,79,0.36); }

        /* ── Stats grid (now includes credits + a Buy button) ── */
        .db-stats {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 14px; margin-bottom: 24px;
        }
        .db-stat-card {
          background: white; border: 1.5px solid #E2EAF0; border-radius: 18px;
          padding: 18px 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          transition: transform 0.2s, box-shadow 0.2s;
          animation: dbCardPop 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        .db-stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 22px rgba(0,0,0,0.09); }
        @keyframes dbCardPop {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .db-stat-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; }
        .db-stat-icon {
          width: 38px; height: 38px; border-radius: 11px;
          display: flex; align-items: center; justify-content: center;
        }
        .db-stat-value {
          font-family: 'Playfair Display', serif;
          font-size: 28px; font-weight: 900; color: #0D1B1B;
          line-height: 1; letter-spacing: -0.5px; margin-bottom: 4px;
        }
        .db-stat-label { font-size: 11.5px; color: #9BAAB8; font-weight: 600; }

        /* Buy credits mini-link inside the credits stat card */
        .db-stat-buy-link {
          font-size: 11px; font-weight: 700; color: #0D4F4F;
          text-decoration: none; display: inline-flex; align-items: center; gap: 3px;
          background: rgba(13,79,79,0.08); padding: 3px 9px; border-radius: 20px;
          transition: background 0.15s;
        }
        .db-stat-buy-link:hover { background: rgba(13,79,79,0.15); }

        /* ── Two-column layout ── */
        .db-columns {
          display: grid; grid-template-columns: 1fr 300px; gap: 22px; align-items: start;
        }
        @media (max-width: 980px) {
          .db-columns { grid-template-columns: 1fr; }
        }

        /* ── Quick actions ── */
        .db-quick-actions {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 10px; margin-bottom: 20px;
        }
        .db-quick-btn {
          display: flex; align-items: center; gap: 8px;
          padding: 12px 14px; background: white;
          border: 1.5px solid #E2EAF0; border-radius: 13px;
          font-size: 13px; font-weight: 700; color: #0D1B1B;
          text-decoration: none; transition: border-color 0.15s, background 0.15s, transform 0.15s;
        }
        .db-quick-btn:hover { border-color: #0D4F4F; background: rgba(13,79,79,0.03); transform: translateY(-1px); }
        .db-quick-btn svg { color: #0D4F4F; flex-shrink: 0; }
        .db-quick-btn.disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }

        /* ── Section card (events) ── */
        .db-section-card {
          background: white; border: 1.5px solid #E2EAF0; border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          animation: dbCardPop 0.5s 0.15s cubic-bezier(0.16,1,0.3,1) both;
        }
        .db-section-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 18px 22px; border-bottom: 1.5px solid #F0F4F8;
        }
        .db-section-title {
          font-family: 'Playfair Display', serif;
          font-size: 17px; font-weight: 800; color: #0D1B1B;
        }
        .db-section-badge {
          font-size: 11px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.08); border: 1px solid rgba(13,79,79,0.12);
          padding: 3px 11px; border-radius: 30px;
        }

        .db-event-row {
          display: flex; align-items: center; gap: 14px;
          padding: 15px 22px; text-decoration: none;
          border-bottom: 1px solid #F7F9FB;
          transition: background 0.15s; position: relative;
        }
        .db-event-row:last-child { border-bottom: none; }
        .db-event-row:hover { background: #F7FAFA; }
        .db-event-row:hover .db-event-arrow { color: #0D4F4F; transform: translateX(3px); }
        .db-event-row::before {
          content: ''; position: absolute; left: 0; top: 18%; bottom: 18%;
          width: 3px; border-radius: 0 2px 2px 0;
          background: linear-gradient(180deg, #0D4F4F, #E8A598);
          opacity: 0; transition: opacity 0.2s;
        }
        .db-event-row:hover::before { opacity: 1; }

        .db-event-date-box {
          width: 46px; height: 46px; border-radius: 13px; flex-shrink: 0;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          display: flex; flex-direction: column; align-items: center; justify-content: center; color: white;
        }
        .db-event-date-day { font-size: 17px; font-weight: 800; line-height: 1; font-family: 'Playfair Display', serif; }
        .db-event-date-mon { font-size: 9px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; opacity: 0.85; margin-top: 2px; }

        .db-event-info { flex: 1 1 0; min-width: 0; }
        .db-event-name { font-size: 14.5px; font-weight: 700; color: #0D1B1B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 2px; }
        .db-event-meta { font-size: 12px; color: #9BAAB8; font-weight: 500; }

        .db-event-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .db-event-guests-badge {
          font-size: 11.5px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.07); padding: 4px 11px; border-radius: 30px;
          white-space: nowrap;
        }
        .db-event-arrow { color: #C8D4DE; flex-shrink: 0; transition: color 0.15s, transform 0.15s; }

        /* ── Empty state ── */
        .db-empty { padding: 56px 24px; text-align: center; }
        .db-empty-icon {
          width: 64px; height: 64px; border-radius: 18px; margin: 0 auto 16px;
          background: rgba(13,79,79,0.07); display: flex; align-items: center; justify-content: center; font-size: 28px;
        }
        .db-empty-title { font-family: 'Playfair Display', serif; font-size: 18px; font-weight: 800; color: #0D1B1B; margin-bottom: 6px; }
        .db-empty-sub { font-size: 13.5px; color: #9BAAB8; line-height: 1.6; }
        .db-empty-btn {
          display: inline-flex; align-items: center; gap: 7px; margin-top: 20px;
          padding: 11px 22px; background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 13.5px; font-weight: 700; text-decoration: none;
          border-radius: 13px; box-shadow: 0 4px 12px rgba(13,79,79,0.3);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .db-empty-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(13,79,79,0.35); }

        /* ── Right panel ── */
        .db-right-panel { display: flex; flex-direction: column; gap: 16px; }
        .db-panel-card {
          background: white; border: 1.5px solid #E2EAF0; border-radius: 18px;
          padding: 20px 22px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          animation: dbCardPop 0.5s 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }
        .db-panel-title {
          font-family: 'Playfair Display', serif;
          font-size: 15px; font-weight: 800; color: #0D1B1B; margin-bottom: 14px;
        }
        .db-quick-link {
          display: flex; align-items: center; gap: 10px;
          padding: 9px 0; border-bottom: 1px solid #F0F4F8;
          font-size: 13.5px; font-weight: 600; color: #4A6072;
          text-decoration: none; transition: color 0.15s, padding-left 0.15s;
        }
        .db-quick-link:last-child { border-bottom: none; }
        .db-quick-link:hover { color: #0D4F4F; padding-left: 4px; }
        .db-quick-link svg { color: #9BAAB8; flex-shrink: 0; transition: color 0.15s; }
        .db-quick-link:hover svg { color: #0D4F4F; }

        .db-help-item {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 13px; color: #4A6072; line-height: 1.55;
          padding: 8px 0;
        }
        .db-help-icon {
          width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
          background: rgba(13,79,79,0.07); color: #0D4F4F;
          display: flex; align-items: center; justify-content: center;
        }

        @media (max-width: 720px) {
          .db-wrap { padding: 24px 16px 56px; }
          .db-title { font-size: 26px; }
          .db-stats { grid-template-columns: repeat(2, 1fr); }
          .db-stat-value { font-size: 22px; }
          .db-quick-actions { grid-template-columns: repeat(2, 1fr); }
          .db-create-btn span { display: none; }
          .db-create-btn { padding: 12px 14px; }
          .db-event-row { padding: 13px 16px; gap: 10px; }
          .db-section-header { padding: 14px 16px; }
          .db-event-guests-badge { display: none; }
        }
      `}</style>

      {/* Header */}
      <div className="db-header">
        <div>
          <div className="db-eyebrow"><div className="db-eyebrow-dot" />Your Dashboard</div>
          <div className="db-title">Hello, <span>{firstName}.</span></div>
          <p className="db-sub">Here's what's happening with your events today.</p>
        </div>
        <Link href={newEventUrl} className="db-create-btn">
          <Plus size={16} /><span>New Event</span>
        </Link>
      </div>

      {/* Stats — credits card now includes its own Buy link, no duplicate block below */}
      <div className="db-stats">
        {stats.map(({ label, value, icon: Icon, bg, color }) => (
          <div key={label} className="db-stat-card">
            <div className="db-stat-top">
              <div className="db-stat-icon" style={{ background: bg }}>
                <Icon size={18} style={{ color }} />
              </div>
              {label === 'Credits' && <BuyCreditsButton currentCredits={tenant?.credits ?? 0} compact />}
            </div>
            <div className="db-stat-value">{typeof value === 'number' ? value.toLocaleString() : value}</div>
            <div className="db-stat-label">{label}</div>
          </div>
        ))}
      </div>

      {/* Two-column layout */}
      <div className="db-columns">
        {/* Left column */}
        <div>
          {/* Quick actions — single source of truth, no duplication with right panel */}
          <div className="db-quick-actions">
            <Link href={newEventUrl} className="db-quick-btn">
              <Plus size={15} /> New Event
            </Link>
            <Link href="/client/guests/import/select-event" className="db-quick-btn">
              <Upload size={15} /> Import Guests
            </Link>
            <Link href="/client/invitations/design/select-event" className="db-quick-btn">
              <Palette size={15} /> Design Card
            </Link>
            <Link href="/client/invitations/send/select-event" className="db-quick-btn">
              <Send size={15} /> Send Invites
            </Link>
          </div>

          {/* Upcoming events */}
          <div className="db-section-card">
            <div className="db-section-header">
              <div className="db-section-title">Upcoming Events</div>
              <div className="db-section-badge">{events.length} event{events.length !== 1 ? 's' : ''}</div>
            </div>

            {events.length === 0 ? (
              <div className="db-empty">
                <div className="db-empty-icon">🎊</div>
                <div className="db-empty-title">No events yet</div>
                <p className="db-empty-sub">Create your first event and start managing guests and invitations.</p>
                <Link href={newEventUrl} className="db-empty-btn">
                  <Plus size={14} /> Create your first event
                </Link>
              </div>
            ) : (
              events.map((event) => {
                const d = new Date(event.date);
                const day = d.getDate();
                const mon = d.toLocaleString('default', { month: 'short' });
                return (
                  <div key={event.id} className="db-event-row">
                    <div className="db-event-date-box">
                      <div className="db-event-date-day">{day}</div>
                      <div className="db-event-date-mon">{mon}</div>
                    </div>
                    <Link href={`/client/events/${event.id}`} style={{ flex: '1 1 0', minWidth: 0, textDecoration: 'none' }}>
                      <div className="db-event-info">
                        <div className="db-event-name">{event.name}</div>
                        <div className="db-event-meta">{event.venue}</div>
                      </div>
                    </Link>
                    <div className="db-event-actions">
                      <span className="db-event-guests-badge">{event._count.guests} guests</span>
                      <DeleteEventButton eventId={event.id} />
                      <Link href={`/client/events/${event.id}`} style={{ display: 'flex' }}>
                        <ArrowRight size={15} className="db-event-arrow" />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="db-right-panel">
          <div className="db-panel-card">
            <div className="db-panel-title">Quick Links</div>
            <Link href="/client/events" className="db-quick-link"><Calendar size={15} /> My Events</Link>
            <Link href="/client/guests" className="db-quick-link"><Users size={15} /> Guest List</Link>
            <Link href="/client/billing" className="db-quick-link"><Coins size={15} /> Billing &amp; Credits</Link>
            <Link href="/client/settings" className="db-quick-link"><Settings size={15} /> Settings</Link>
          </div>

          <div className="db-panel-card">
            <div className="db-panel-title">Need Help?</div>
            <div className="db-help-item">
              <div className="db-help-icon"><BookOpen size={14} /></div>
              Check the documentation for setup guides.
            </div>
            <div className="db-help-item">
              <div className="db-help-icon"><MessageSquare size={14} /></div>
              Contact support via chat or email.
            </div>
            <div className="db-help-item">
              <div className="db-help-icon"><Palette size={14} /></div>
              Use the card designer to create unique invitations.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}