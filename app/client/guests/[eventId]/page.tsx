import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Users, CalendarDays, ChevronRight, PlusCircle } from 'lucide-react';

export default async function GuestsPage() {
  const session = await getServerSession();
  if (!session) redirect('/login');

  const tenantId = (session.user as any).tenantId;
  if (!tenantId) {
    return (
      <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", padding: '40px 24px', color: '#7A8FA6', textAlign: 'center' }}>
        No organisation linked to your account.
      </div>
    );
  }

  const events = await prisma.event.findMany({
    where: { tenantId },
    select: { id: true, name: true, date: true },
    orderBy: { date: 'desc' },
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .gp-wrap {
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          max-width: 680px;
          margin: 0 auto;
          padding: 48px 24px 64px;
          animation: gpFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes gpFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Header */
        .gp-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 32px;
          gap: 16px;
          flex-wrap: wrap;
        }

        .gp-header-left {}

        .gp-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          color: #0D4F4F; text-transform: uppercase; margin-bottom: 6px;
          display: flex; align-items: center; gap: 7px;
        }
        .gp-eyebrow-dot {
          width: 5px; height: 5px; border-radius: 50%; background: #E8A598;
        }

        .gp-title {
          font-family: 'Playfair Display', serif;
          font-size: 32px; font-weight: 900;
          color: #0D1B1B; line-height: 1.15;
          letter-spacing: -0.5px; margin: 0 0 6px;
        }
        .gp-title span { color: #E8A598; }

        .gp-subtitle {
          font-size: 14px; color: #7A8FA6; line-height: 1.6; margin: 0;
        }

        /* Stat pill */
        .gp-stat {
          display: flex; align-items: center; gap: 8px;
          background: white; border: 1.5px solid #E2EAF0;
          border-radius: 14px; padding: 12px 18px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          flex-shrink: 0;
        }
        .gp-stat-icon {
          width: 34px; height: 34px; border-radius: 10px; flex-shrink: 0;
          background: rgba(13,79,79,0.08); border: 1px solid rgba(13,79,79,0.12);
          display: flex; align-items: center; justify-content: center; color: #0D4F4F;
        }
        .gp-stat-num { font-size: 20px; font-weight: 800; color: #0D1B1B; line-height: 1; }
        .gp-stat-label { font-size: 11px; color: #9BAAB8; font-weight: 500; margin-top: 1px; }

        /* Divider */
        .gp-divider {
          height: 1px; background: linear-gradient(90deg, #E2EAF0, transparent);
          margin-bottom: 24px;
        }

        /* Event list */
        .gp-list {
          display: flex; flex-direction: column; gap: 12px;
        }

        .gp-card {
          display: flex; align-items: center; gap: 16px;
          background: white; border: 1.5px solid #E2EAF0; border-radius: 18px;
          padding: 18px 20px; text-decoration: none;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
          transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
          animation: gpCardIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        .gp-card:hover {
          border-color: #0D4F4F;
          box-shadow: 0 4px 20px rgba(13,79,79,0.12);
          transform: translateY(-2px);
        }

        @keyframes gpCardIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .gp-card-icon {
          width: 44px; height: 44px; border-radius: 13px; flex-shrink: 0;
          background: linear-gradient(135deg, rgba(13,79,79,0.1), rgba(13,79,79,0.05));
          border: 1px solid rgba(13,79,79,0.12);
          display: flex; align-items: center; justify-content: center; color: #0D4F4F;
        }

        .gp-card-body { flex: 1; min-width: 0; }
        .gp-card-name {
          font-size: 15px; font-weight: 700; color: #0D1B1B;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-bottom: 3px;
        }
        .gp-card-date {
          display: flex; align-items: center; gap: 5px;
          font-size: 12.5px; color: #9BAAB8; font-weight: 500;
        }

        .gp-card-arrow {
          color: #C8D4DE; flex-shrink: 0;
          transition: color 0.2s, transform 0.2s;
        }
        .gp-card:hover .gp-card-arrow {
          color: #0D4F4F;
          transform: translateX(3px);
        }

        /* Bar accent on hover */
        .gp-card::before {
          content: '';
          position: absolute;
          left: 0; top: 20%; bottom: 20%;
          width: 3px; border-radius: 0 2px 2px 0;
          background: linear-gradient(180deg, #0D4F4F, #E8A598);
          opacity: 0; transition: opacity 0.2s;
        }
        .gp-card { position: relative; overflow: hidden; }
        .gp-card:hover::before { opacity: 1; }

        /* Empty state */
        .gp-empty {
          text-align: center; padding: 56px 24px;
          background: white; border: 1.5px dashed #E2EAF0;
          border-radius: 20px;
        }
        .gp-empty-icon {
          width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 16px;
          background: rgba(13,79,79,0.06); border: 1.5px solid rgba(13,79,79,0.1);
          display: flex; align-items: center; justify-content: center; color: #0D4F4F;
        }
        .gp-empty-title {
          font-family: 'Playfair Display', serif;
          font-size: 18px; font-weight: 800; color: #0D1B1B; margin-bottom: 6px;
        }
        .gp-empty-sub { font-size: 13.5px; color: #9BAAB8; line-height: 1.6; margin-bottom: 22px; }

        .gp-empty-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 11px 22px; border-radius: 12px; border: none;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 14px; font-weight: 700;
          font-family: inherit; cursor: pointer; text-decoration: none;
          box-shadow: 0 4px 14px rgba(13,79,79,0.3);
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .gp-empty-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(13,79,79,0.38); }

        @media (max-width: 540px) {
          .gp-wrap { padding: 28px 16px 48px; }
          .gp-title { font-size: 26px; }
          .gp-stat { display: none; }
        }
      `}</style>

      <div className="gp-wrap">
        {/* Header */}
        <div className="gp-header">
          <div className="gp-header-left">
            <div className="gp-eyebrow">
              <div className="gp-eyebrow-dot" />
              Guest Management
            </div>
            <h1 className="gp-title">
              Your <span>Events</span>
            </h1>
            <p className="gp-subtitle">Select an event to view and manage its guest list.</p>
          </div>

          <div className="gp-stat">
            <div className="gp-stat-icon"><Users size={17} /></div>
            <div>
              <div className="gp-stat-num">{events.length}</div>
              <div className="gp-stat-label">{events.length === 1 ? 'Event' : 'Events'}</div>
            </div>
          </div>
        </div>

        <div className="gp-divider" />

        {/* Event cards */}
        {events.length > 0 ? (
          <div className="gp-list">
            {events.map((event, i) => (
              <Link
                key={event.id}
                href={`/client/guests/${event.id}`}
                className="gp-card"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="gp-card-icon">
                  <Users size={20} />
                </div>
                <div className="gp-card-body">
                  <div className="gp-card-name">{event.name}</div>
                  <div className="gp-card-date">
                    <CalendarDays size={12} />
                    {new Date(event.date).toLocaleDateString('en-US', {
                      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </div>
                </div>
                <ChevronRight size={18} className="gp-card-arrow" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="gp-empty">
            <div className="gp-empty-icon"><Users size={24} /></div>
            <div className="gp-empty-title">No events yet</div>
            <p className="gp-empty-sub">
              Create your first event to start managing<br />guests, invitations, and check-ins.
            </p>
            <Link href="/client/events/new" className="gp-empty-btn">
              <PlusCircle size={15} />
              Create an Event
            </Link>
          </div>
        )}
      </div>
    </>
  );
}