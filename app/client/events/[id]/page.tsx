import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { Calendar, MapPin, Users, QrCode, MessageCircle, Phone, ArrowRight, ArrowLeft, Upload, Plus, Palette, Send, Smartphone } from 'lucide-react';
import { format } from 'date-fns';
import { authOptions } from '@/lib/auth';

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || !['CLIENT', 'SUPER_ADMIN'].includes((session.user as any).role)) {
    redirect('/login');
  }

  const tenantId = (session.user as any).tenantId;
  const { id } = await params;

  const event = await prisma.event.findFirst({
    where: { id, tenantId },
    include: { guests: true },
  });

  if (!event) {
    return (
      <div style={{
        minHeight: '100vh', background: '#F0F4F8',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Sans', sans-serif", padding: 24,
      }}>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700;800&display=swap');`}</style>
        <div style={{
          background: 'white', borderRadius: 24, padding: '40px 32px', maxWidth: 400,
          textAlign: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: 22, fontWeight: 800, color: '#0D1B1B', marginBottom: 8,
          }}>Event Not Found</h1>
          <p style={{ color: '#9BAAB8', fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
            This event doesn't exist or you don't have access to it.
          </p>
          <Link
            href="/client/dashboard"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '12px 24px', background: 'linear-gradient(135deg, #0D4F4F, #0A3D3D)',
              color: 'white', fontSize: 14, fontWeight: 700, borderRadius: 12,
              textDecoration: 'none', transition: 'transform 0.15s, box-shadow 0.15s',
            }}
          >
            <ArrowLeft size={14} /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const checkedInCount = event.guests.filter(g => g.checkedIn).length;
  const whatsappCount = event.guests.filter(g => g.routingChannel === 'whatsapp').length;
  const smsCount = event.guests.filter(g => g.routingChannel === 'sms').length;
  const attendingCount = event.guests.filter(g => g.attending === 'yes').length;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F0F4F8',
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      paddingBottom: 100,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .wrap {
          max-width: 900px; margin: 0 auto;
          padding: 40px 24px 32px;
          animation: fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Back link */
        .back-link {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 700; color: #0D4F4F;
          text-decoration: none; margin-bottom: 24px;
          padding: 7px 14px;
          background: rgba(13,79,79,0.08);
          border: 1px solid rgba(13,79,79,0.12);
          border-radius: 10px;
          transition: background 0.15s;
        }
        .back-link:hover { background: rgba(13,79,79,0.14); }

        /* Event header */
        .event-header {
          margin-bottom: 28px;
        }

        .event-title {
          font-family: 'Playfair Display', serif;
          font-size: 32px; font-weight: 900; color: #0D1B1B;
          line-height: 1.1; letter-spacing: -0.5px; margin-bottom: 12px;
        }

        .event-meta {
          display: flex; flex-wrap: wrap; gap: 14px;
          font-size: 13.5px; color: #7A8FA6; font-weight: 500;
        }

        .meta-item {
          display: flex; align-items: center; gap: 6px;
        }

        .meta-icon {
          width: 16px; height: 16px; color: #0D4F4F;
        }

        .event-address {
          font-size: 13px; color: #9BAAB8; margin-top: 8px;
        }

        /* Stats grid */
        .stats-grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 14px; margin-bottom: 28px;
        }

        .stat-card {
          background: white; border-radius: 18px; padding: 18px 16px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          text-align: center; transition: transform 0.2s, box-shadow 0.2s;
          animation: cardPop 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        .stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.08); }

        .stat-card:nth-child(1) { animation-delay: 0.05s; }
        .stat-card:nth-child(2) { animation-delay: 0.1s; }
        .stat-card:nth-child(3) { animation-delay: 0.15s; }
        .stat-card:nth-child(4) { animation-delay: 0.2s; }

        @keyframes cardPop {
          from { opacity: 0; transform: translateY(12px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .stat-icon-wrap {
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 10px; font-size: 16px;
        }

        .stat-value {
          font-family: 'Playfair Display', serif;
          font-size: 26px; font-weight: 900; color: #0D1B1B;
          line-height: 1; margin-bottom: 4px;
        }

        .stat-label {
          font-size: 11px; font-weight: 600; color: #9BAAB8;
          letter-spacing: 0.2px;
        }

        /* Action buttons */
        .actions-wrap {
          margin-bottom: 28px;
        }

        .actions-grid {
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        .action-btn {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 14px 16px; border: none; border-radius: 14px;
          font-size: 13px; font-weight: 700; font-family: inherit;
          text-decoration: none; cursor: pointer; color: white;
          transition: transform 0.15s, box-shadow 0.15s;
          position: relative; overflow: hidden;
        }

        .action-btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
          opacity: 0; transition: opacity 0.2s;
        }

        .action-btn:hover::after { opacity: 1; }
        .action-btn:hover { transform: translateY(-2px); }

        .action-primary {
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          box-shadow: 0 4px 12px rgba(13,79,79,0.3);
          grid-column: span 2;
        }
        .action-primary:hover { box-shadow: 0 8px 20px rgba(13,79,79,0.35); }

        .action-secondary {
          background: rgba(13,79,79,0.1);
          color: #0D4F4F; font-weight: 700;
          border: 1.5px solid rgba(13,79,79,0.15);
        }
        .action-secondary:hover { background: rgba(13,79,79,0.15); transform: translateY(-2px); }

        /* Guest list card */
        .guest-card {
          background: white; border-radius: 20px; overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.05);
          animation: cardPop 0.55s 0.25s cubic-bezier(0.16,1,0.3,1) both;
        }

        .guest-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 22px; border-bottom: 1.5px solid #F0F4F8;
        }

        .guest-title {
          font-family: 'Playfair Display', serif;
          font-size: 16px; font-weight: 800; color: #0D1B1B;
        }

        .guest-badge {
          font-size: 11px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.08); padding: 3px 10px;
          border-radius: 20px;
        }

        .guest-list {
          max-height: 500px; overflow-y: auto;
        }

        .guest-row {
          padding: 14px 22px; border-bottom: 1px solid #F7F9FB;
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; transition: background 0.15s;
        }
        .guest-row:hover { background: #F7FAFA; }
        .guest-row:last-child { border-bottom: none; }

        .guest-info { flex: 1; min-width: 0; }

        .guest-name {
          font-size: 14px; font-weight: 700; color: #0D1B1B;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .guest-phone {
          font-size: 12px; color: #9BAAB8; margin-top: 2px;
        }

        .guest-channel {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 11px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.07); padding: 2px 8px;
          border-radius: 12px; margin-top: 4px;
        }

        .guest-status {
          display: flex; flex-direction: column; align-items: flex-end;
          gap: 6px; flex-shrink: 0;
        }

        .status-badge {
          font-size: 11.5px; font-weight: 700; padding: 4px 10px;
          border-radius: 20px; white-space: nowrap;
        }

        .status-checked {
          background: #EDFAF4; color: #1A7A4A;
        }

        .status-pending {
          background: #FEF6EC; color: #C07A20;
        }

        .empty-state {
          padding: 56px 24px; text-align: center;
        }

        .empty-icon {
          width: 60px; height: 60px; border-radius: 16px;
          background: rgba(13,79,79,0.07);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px; font-size: 26px;
        }

        .empty-title {
          font-family: 'Playfair Display', serif;
          font-size: 18px; font-weight: 800; color: #0D1B1B;
          margin-bottom: 6px;
        }

        .empty-sub {
          font-size: 13.5px; color: #9BAAB8;
        }

        @media (max-width: 768px) {
          .wrap { padding: 24px 16px 20px; }
          .event-title { font-size: 26px; }
          .stats-grid { grid-template-columns: repeat(2, 1fr); }
          .action-btn { font-size: 12px; padding: 12px 14px; }
          .action-primary { grid-column: span 2; }
          .guest-row { padding: 12px 16px; }
        }

        @media (max-width: 640px) {
          .event-meta { flex-direction: column; gap: 8px; }
          .stats-grid { gap: 10px; }
          .actions-grid { grid-template-columns: 1fr; }
          .action-primary { grid-column: span 1; }
        }
      `}</style>

      <div className="wrap">

        {/* Back */}
        <Link href="/client/dashboard" className="back-link">
          <ArrowLeft size={14} /> Back to Dashboard
        </Link>

        {/* Event header */}
        <div className="event-header">
          <h1 className="event-title">{event.name}</h1>
          <div className="event-meta">
            <div className="meta-item">
              <Calendar size={16} className="meta-icon" />
              {format(new Date(event.date), 'PPP')}
            </div>
            <div className="meta-item">
              <MapPin size={16} className="meta-icon" />
              {event.venue}
            </div>
          </div>
          <p className="event-address">{event.address}</p>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ background: 'rgba(13,79,79,0.08)', color: '#0D4F4F' }}>
              <Users size={18} />
            </div>
            <div className="stat-value">{event.guests.length}</div>
            <div className="stat-label">Total Guests</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ background: '#EDFAF4', color: '#1A7A4A' }}>
              <Smartphone size={18} />
            </div>
            <div className="stat-value">{checkedInCount}</div>
            <div className="stat-label">Checked In</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ background: '#EAF4F4', color: '#0D4F4F' }}>
              <MessageCircle size={18} />
            </div>
            <div className="stat-value">{whatsappCount}</div>
            <div className="stat-label">WhatsApp</div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap" style={{ background: '#FEF6EC', color: '#C07A20' }}>
              <Phone size={18} />
            </div>
            <div className="stat-value">{smsCount}</div>
            <div className="stat-label">SMS</div>
          </div>
        </div>

        {/* Actions */}
        <div className="actions-wrap">
          <div className="actions-grid">
            <Link href={`/client/invitations/send/${event.id}`} className="action-btn action-primary">
              <Send size={15} /> Send Invitations
            </Link>

            <Link href={`/client/guests/import/${event.id}`} className="action-btn action-secondary">
              <Upload size={14} /> Import Guests
            </Link>

            <Link href={`/client/guests/add/${event.id}`} className="action-btn action-secondary">
              <Plus size={14} /> Add Guest
            </Link>

            <Link href={`/client/invitations/design/${event.id}`} className="action-btn action-secondary">
              <Palette size={14} /> Design Card
            </Link>

            <Link href={`/client/check-in?event=${event.id}`} className="action-btn action-secondary">
              <QrCode size={14} /> Check-In
            </Link>
          </div>
        </div>

        {/* Guest list */}
        <div className="guest-card">
          <div className="guest-header">
            <h2 className="guest-title">Guest List</h2>
            <div className="guest-badge">{event.guests.length} guest{event.guests.length !== 1 ? 's' : ''}</div>
          </div>

          {event.guests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <div className="empty-title">No guests yet</div>
              <p className="empty-sub">Import a guest list or add guests manually to get started.</p>
            </div>
          ) : (
            <div className="guest-list">
              {event.guests.map(guest => (
                <div key={guest.id} className="guest-row">
                  <div className="guest-info">
                    <div className="guest-name">{guest.name}</div>
                    {guest.phone && <div className="guest-phone">{guest.phone}</div>}
                    <div className="guest-channel">
                      {guest.routingChannel === 'whatsapp' ? (
                        <>
                          <MessageCircle size={11} /> WhatsApp
                        </>
                      ) : (
                        <>
                          <Phone size={11} /> SMS
                        </>
                      )}
                    </div>
                  </div>
                  <div className="guest-status">
                    {guest.checkedIn ? (
                      <div className="status-badge status-checked">✓ Checked in</div>
                    ) : (
                      <div className="status-badge status-pending">Pending</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}