'use client';

import {
  Calendar, Users, QrCode, Plus, Coins, Upload, Palette, Send,
  ArrowRight, Settings, BookOpen, MessageSquare, Download, Sparkles,
  Zap, Heart, type LucideIcon
} from 'lucide-react';
import Link from 'next/link';
import DeleteEventButton from '@/components/DeleteEventButton';
import BuyCreditsButton from '@/app/components/BuyCreditsButton';
import { HeroCarousel } from '@/app/components/HeroCarousel';

interface DashboardContentProps {
  firstName: string;
  credits: number;
  totalGuests: number;
  checkedIn: number;
  events: {
    id: string;
    name: string;
    date: string;
    venue: string;
    _count: { guests: number };
  }[];
  newEventUrl: string;
}

interface QuickLink {
  label: string;
  icon: LucideIcon;
  href: string;
  color?: string;
}

export default function DashboardContent({
  firstName,
  credits,
  totalGuests,
  checkedIn,
  events,
  newEventUrl,
}: DashboardContentProps) {
  const stats = [
    { label: 'Credits', value: credits, icon: Coins, color: '#C07A20' },
    { label: 'Total Guests', value: totalGuests, icon: Users, color: '#0D4F4F' },
    { label: 'Checked In', value: checkedIn, icon: QrCode, color: '#1A7A4A' },
    { label: 'Events', value: events.length, icon: Calendar, color: '#6B3FA0' },
  ];

  // Modern neumorphism action buttons with refined colors and shadows
  const actionButtons: QuickLink[] = [
    { label: 'New Event', icon: Plus, href: newEventUrl, color: '#0D4F4F' },
    { label: 'Import Guests', icon: Upload, href: '/client/guests/import/select-event', color: '#1A7A4A' },
    { label: 'Design Card', icon: Palette, href: '/client/invitations/design/select-event', color: '#C07A20' },
    { label: 'Send Invites', icon: Send, href: '/client/invitations/send/select-event', color: '#0D4F4F' },
    { label: 'Backup Guests', icon: Download, href: '/client/guests/backup', color: '#6B3FA0' },
  ];

  const quickLinks: QuickLink[] = [
    { label: 'My Events', icon: Calendar, href: '/client/events' },
    { label: 'Guest List', icon: Users, href: '/client/guests' },
    { label: 'Backup Guests', icon: Download, href: '/client/guests/backup' },
    { label: 'Billing & Credits', icon: Coins, href: '/client/billing' },
    { label: 'Settings', icon: Settings, href: '/client/settings' },
  ];

  const helpItems = [
    { icon: BookOpen, text: 'Check the documentation for setup guides.' },
    { icon: MessageSquare, text: 'Contact support via chat or email.' },
    { icon: Palette, text: 'Use the card designer to create unique invitations.' },
  ];

  return (
    <div className="db-wrap">
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');

        .db-wrap {
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          max-width: 1200px;
          margin: 0 auto;
          padding: 24px 20px 64px;
          background: #E8EDF2;
          min-height: 100vh;
        }

        /* ─── Neumorphism Base ─── */
        .neu {
          background: #E8EDF2;
          border-radius: 20px;
          box-shadow: 
            8px 8px 16px rgba(174, 186, 198, 0.6),
            -8px -8px 16px rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }

        /* ─── Hero ─── */
        .db-hero-container {
          margin-bottom: 32px;
          border-radius: 24px;
          overflow: hidden;
          background: #E8EDF2;
          box-shadow: 
            6px 6px 14px rgba(174, 186, 198, 0.6),
            -6px -6px 14px rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        /* ─── Header ─── */
        .db-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 28px;
          gap: 16px;
          flex-wrap: wrap;
        }
        .db-eyebrow {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: #0D4F4F;
          text-transform: uppercase;
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .db-eyebrow-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: #E8A598;
        }
        .db-title {
          font-family: 'Playfair Display', serif;
          font-size: 34px;
          font-weight: 900;
          color: #0D1B1B;
          line-height: 1.1;
          letter-spacing: -0.5px;
          margin: 0;
        }
        .db-title span { color: #E8A598; }
        .db-sub {
          color: #7A8FA6;
          font-size: 14px;
          margin-top: 4px;
        }

        .db-create-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border: none;
          border-radius: 16px;
          background: #0D4F4F;
          color: white;
          font-size: 14px;
          font-weight: 700;
          text-decoration: none;
          white-space: nowrap;
          font-family: 'DM Sans', sans-serif;
          box-shadow: 
            4px 4px 10px rgba(13, 79, 79, 0.3),
            -2px -2px 6px rgba(255, 255, 255, 0.4);
          transition: all 0.25s ease;
        }
        .db-create-btn:hover {
          transform: translateY(-2px);
          box-shadow: 
            6px 6px 14px rgba(13, 79, 79, 0.4),
            -4px -4px 10px rgba(255, 255, 255, 0.5);
        }
        .db-create-btn:active {
          transform: translateY(0px);
          box-shadow: 
            inset 2px 2px 6px rgba(13, 79, 79, 0.3),
            inset -2px -2px 6px rgba(255, 255, 255, 0.2);
        }

        /* ─── Stats ─── */
        .db-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-bottom: 24px;
        }
        .db-stat-card {
          background: #E8EDF2;
          border-radius: 20px;
          padding: 18px 20px;
          box-shadow: 
            6px 6px 14px rgba(174, 186, 198, 0.6),
            -6px -6px 14px rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
        }
        .db-stat-card:hover {
          box-shadow: 
            8px 8px 20px rgba(174, 186, 198, 0.7),
            -8px -8px 20px rgba(255, 255, 255, 0.9);
          transform: translateY(-3px);
        }
        .db-stat-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          margin-bottom: 12px;
        }
        .db-stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #E8EDF2;
          box-shadow: 
            inset 2px 2px 6px rgba(174, 186, 198, 0.5),
            inset -2px -2px 6px rgba(255, 255, 255, 0.7);
        }
        .db-stat-value {
          font-family: 'Playfair Display', serif;
          font-size: 30px;
          font-weight: 900;
          color: #0D1B1B;
          line-height: 1;
          letter-spacing: -0.5px;
        }
        .db-stat-label {
          font-size: 11.5px;
          color: #7A8FA6;
          font-weight: 600;
          margin-top: 4px;
          letter-spacing: 0.3px;
        }

        /* ─── Modern Neumorphism Quick Actions ─── */
        .db-quick-actions {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
          margin-bottom: 28px;
        }

        .db-quick-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 16px 12px;
          border: none;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 600;
          color: white;
          text-decoration: none;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          min-height: 52px;
          text-align: center;
          line-height: 1.2;
          position: relative;
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.2px;
          box-shadow: 
            6px 6px 14px rgba(0, 0, 0, 0.25),
            -4px -4px 10px rgba(255, 255, 255, 0.3),
            inset 0 2px 4px rgba(255, 255, 255, 0.1);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
        }

        .db-quick-btn::before {
          content: '';
          position: absolute;
          top: 2px;
          left: 15%;
          right: 15%;
          height: 30%;
          background: radial-gradient(ellipse at center, rgba(255,255,255,0.25) 0%, transparent 70%);
          border-radius: 50%;
          opacity: 0.7;
          transition: opacity 0.3s ease;
          pointer-events: none;
        }

        .db-quick-btn:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: 
            8px 8px 20px rgba(0, 0, 0, 0.3),
            -6px -6px 14px rgba(255, 255, 255, 0.4),
            inset 0 2px 4px rgba(255, 255, 255, 0.15);
        }

        .db-quick-btn:hover::before {
          opacity: 1;
        }

        .db-quick-btn:active {
          transform: translateY(0px) scale(0.97);
          box-shadow: 
            inset 4px 4px 10px rgba(0, 0, 0, 0.25),
            inset -2px -2px 6px rgba(255, 255, 255, 0.15);
        }

        .db-quick-btn:active::before {
          opacity: 0.3;
        }

        .db-quick-btn svg {
          flex-shrink: 0;
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));
        }

        .db-quick-btn.btn-new-event {
          background: linear-gradient(145deg, #0D4F4F, #0A3D3D);
        }
        .db-quick-btn.btn-import-guests {
          background: linear-gradient(145deg, #1A7A4A, #145C38);
        }
        .db-quick-btn.btn-design-card {
          background: linear-gradient(145deg, #C07A20, #92580A);
        }
        .db-quick-btn.btn-send-invites {
          background: linear-gradient(145deg, #0D4F4F, #0A3D3D);
        }
        .db-quick-btn.btn-backup-guests {
          background: linear-gradient(145deg, #6B3FA0, #4A2A7A);
        }

        /* ─── Features ─── */
        .db-features {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 28px;
        }
        .db-feature-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #E8EDF2;
          border-radius: 16px;
          font-size: 13px;
          font-weight: 600;
          color: #4A6072;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.2px;
          box-shadow: 
            4px 4px 10px rgba(174, 186, 198, 0.5),
            -4px -4px 10px rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.2s ease;
        }
        .db-feature-item:hover {
          box-shadow: 
            2px 2px 6px rgba(174, 186, 198, 0.5),
            -2px -2px 6px rgba(255, 255, 255, 0.7);
          transform: translateY(-1px);
        }
        .db-feature-item svg { color: #0D4F4F; }

        .db-columns {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 22px;
          align-items: start;
        }
        @media (max-width: 980px) {
          .db-columns { grid-template-columns: 1fr; }
        }

        /* ─── Events Section ─── */
        .db-section-card {
          background: #E8EDF2;
          border-radius: 24px;
          overflow: hidden;
          box-shadow: 
            6px 6px 14px rgba(174, 186, 198, 0.6),
            -6px -6px 14px rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .db-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px;
          border-bottom: 1px solid rgba(174, 186, 198, 0.3);
        }
        .db-section-title {
          font-family: 'Playfair Display', serif;
          font-size: 17px;
          font-weight: 800;
          color: #0D1B1B;
        }
        .db-section-badge {
          font-size: 11px;
          font-weight: 700;
          color: #0D4F4F;
          background: #E8EDF2;
          padding: 3px 11px;
          border-radius: 30px;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.3px;
          box-shadow: 
            inset 2px 2px 6px rgba(174, 186, 198, 0.5),
            inset -2px -2px 6px rgba(255, 255, 255, 0.7);
        }

        .db-event-row {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 15px 22px;
          text-decoration: none;
          border-bottom: 1px solid rgba(174, 186, 198, 0.2);
          transition: all 0.2s ease;
        }
        .db-event-row:last-child { border-bottom: none; }
        .db-event-row:hover {
          background: rgba(255, 255, 255, 0.4);
          box-shadow: inset 0 2px 8px rgba(174, 186, 198, 0.2);
        }

        .db-event-date-box {
          width: 46px;
          height: 46px;
          border-radius: 14px;
          flex-shrink: 0;
          background: #0D4F4F;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: white;
          box-shadow: 
            4px 4px 10px rgba(13, 79, 79, 0.3),
            -2px -2px 6px rgba(255, 255, 255, 0.3);
        }
        .db-event-date-day {
          font-size: 17px;
          font-weight: 800;
          line-height: 1;
          font-family: 'Playfair Display', serif;
        }
        .db-event-date-mon {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          opacity: 0.85;
          margin-top: 2px;
          font-family: 'DM Sans', sans-serif;
        }

        .db-event-info { flex: 1; min-width: 0; }
        .db-event-name {
          font-size: 14px;
          font-weight: 700;
          color: #0D1B1B;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.2px;
        }
        .db-event-meta {
          font-size: 12px;
          color: #7A8FA6;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.2px;
        }

        .db-event-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .db-event-guests-badge {
          font-size: 11px;
          font-weight: 700;
          color: #0D4F4F;
          background: #E8EDF2;
          padding: 4px 11px;
          border-radius: 30px;
          white-space: nowrap;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.3px;
          box-shadow: 
            inset 2px 2px 6px rgba(174, 186, 198, 0.5),
            inset -2px -2px 6px rgba(255, 255, 255, 0.7);
        }

        .db-empty {
          padding: 48px 24px;
          text-align: center;
        }
        .db-empty-icon {
          width: 64px;
          height: 64px;
          border-radius: 18px;
          margin: 0 auto 16px;
          background: #E8EDF2;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 
            4px 4px 10px rgba(174, 186, 198, 0.5),
            -4px -4px 10px rgba(255, 255, 255, 0.7);
        }
        .db-empty-title {
          font-family: 'Playfair Display', serif;
          font-size: 18px;
          font-weight: 800;
          color: #0D1B1B;
        }
        .db-empty-sub {
          font-size: 13.5px;
          color: #7A8FA6;
          line-height: 1.6;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.2px;
        }
        .db-empty-btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-top: 20px;
          padding: 11px 22px;
          background: #0D4F4F;
          color: white;
          font-size: 13.5px;
          font-weight: 700;
          text-decoration: none;
          border-radius: 14px;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.2px;
          box-shadow: 
            4px 4px 10px rgba(13, 79, 79, 0.3),
            -2px -2px 6px rgba(255, 255, 255, 0.4);
          transition: all 0.2s ease;
        }
        .db-empty-btn:hover {
          transform: translateY(-2px);
          box-shadow: 
            6px 6px 16px rgba(13, 79, 79, 0.4),
            -4px -4px 10px rgba(255, 255, 255, 0.5);
        }

        /* ─── Right Panel ─── */
        .db-right-panel {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .db-panel-card {
          background: #E8EDF2;
          border-radius: 20px;
          padding: 20px 22px;
          box-shadow: 
            6px 6px 14px rgba(174, 186, 198, 0.6),
            -6px -6px 14px rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transition: all 0.3s ease;
        }
        .db-panel-card:hover {
          box-shadow: 
            8px 8px 20px rgba(174, 186, 198, 0.7),
            -8px -8px 20px rgba(255, 255, 255, 0.9);
        }
        .db-panel-title {
          font-family: 'Playfair Display', serif;
          font-size: 15px;
          font-weight: 800;
          color: #0D1B1B;
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .db-panel-title::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(174, 186, 198, 0.4);
        }

        /* ─── Quick Links (matching Need Help style) ─── */
        .db-quick-link {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 600;
          color: #4A6072;
          text-decoration: none;
          transition: all 0.25s ease;
          margin-bottom: 2px;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.2px;
          background: transparent;
        }
        .db-quick-link:last-child { margin-bottom: 0; }
        .db-quick-link:hover {
          color: #0D4F4F;
          background: rgba(255, 255, 255, 0.5);
          box-shadow: 
            inset 2px 2px 6px rgba(174, 186, 198, 0.3),
            inset -2px -2px 6px rgba(255, 255, 255, 0.6);
          transform: translateX(4px);
        }
        .db-quick-link svg {
          color: #9BAAB8;
          flex-shrink: 0;
          transition: color 0.2s;
        }
        .db-quick-link:hover svg { color: #0D4F4F; }

        /* ─── Help Items ─── */
        .db-help-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          font-size: 13px;
          font-weight: 500;
          color: #4A6072;
          line-height: 1.55;
          padding: 8px 0;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 0.2px;
        }
        .db-help-icon {
          width: 32px;
          height: 32px;
          border-radius: 12px;
          flex-shrink: 0;
          background: #E8EDF2;
          color: #0D4F4F;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 
            2px 2px 6px rgba(174, 186, 198, 0.5),
            -2px -2px 6px rgba(255, 255, 255, 0.7);
          transition: all 0.2s ease;
        }
        .db-help-item:hover .db-help-icon {
          box-shadow: 
            inset 2px 2px 6px rgba(174, 186, 198, 0.5),
            inset -2px -2px 6px rgba(255, 255, 255, 0.7);
          transform: scale(0.95);
        }

        /* ─── Responsive ─── */
        @media (max-width: 1024px) {
          .db-quick-actions { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 820px) {
          .db-stats { grid-template-columns: repeat(2, 1fr); }
          .db-features { grid-template-columns: repeat(2, 1fr); }
          .db-title { font-size: 28px; }
          .db-quick-actions { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 520px) {
          .db-stats { grid-template-columns: 1fr; }
          .db-quick-actions { grid-template-columns: 1fr; }
          .db-features { grid-template-columns: 1fr; }
          .db-event-row { flex-wrap: wrap; }
          .db-event-actions { width: 100%; justify-content: flex-end; }
        }
      `}</style>

      {/* ─── Hero Carousel ─── */}
      <div className="db-hero-container">
        <HeroCarousel />
      </div>

      {/* ─── Header ─── */}
      <div className="db-header">
        <div>
          <div className="db-eyebrow">
            <div className="db-eyebrow-dot" />
            Your Dashboard
          </div>
          <h1 className="db-title">
            Hello, <span>{firstName}</span>
          </h1>
          <p className="db-sub">Here's what's happening with your events today.</p>
        </div>
        <Link href={newEventUrl} className="db-create-btn">
          <Plus size={16} />
          <span>New Event</span>
        </Link>
      </div>

      {/* ─── Stats ─── */}
      <div className="db-stats">
        {stats.map((stat) => (
          <div key={stat.label} className="db-stat-card">
            <div className="db-stat-top">
              <div className="db-stat-icon">
                <stat.icon size={18} style={{ color: stat.color }} />
              </div>
              {stat.label === 'Credits' && (
                <BuyCreditsButton currentCredits={credits} compact />
              )}
            </div>
            <div className="db-stat-value">{typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}</div>
            <div className="db-stat-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Modern Neumorphism Quick Actions ─── */}
      <div className="db-quick-actions">
        {actionButtons.map((btn) => (
          <Link
            key={btn.label}
            href={btn.href}
            className={`db-quick-btn btn-${btn.label.toLowerCase().replace(/ /g, '-')}`}
          >
            <btn.icon size={16} />
            {btn.label}
          </Link>
        ))}
      </div>

      {/* ─── Features Row ─── */}
      <div className="db-features">
        <div className="db-feature-item">
          <Users size={16} /> Guest Management
        </div>
        <div className="db-feature-item">
          <QrCode size={16} /> QR Check-in
        </div>
        <div className="db-feature-item">
          <Send size={16} /> WhatsApp &amp; SMS
        </div>
        <div className="db-feature-item">
          <Palette size={16} /> Custom Cards
        </div>
      </div>

      {/* ─── Two-column Layout ─── */}
      <div className="db-columns">
        <div>
          <div className="db-section-card">
            <div className="db-section-header">
              <div className="db-section-title">Upcoming Events</div>
              <div className="db-section-badge">
                {events.length} event{events.length !== 1 ? 's' : ''}
              </div>
            </div>

            {events.length === 0 ? (
              <div className="db-empty">
                <div className="db-empty-icon">
                  <Sparkles className="w-8 h-8 text-[#0D4F4F]" />
                </div>
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
                    <Link href={`/client/events/${event.id}`} className="db-event-info" style={{ textDecoration: 'none' }}>
                      <div className="db-event-name">{event.name}</div>
                      <div className="db-event-meta">{event.venue}</div>
                    </Link>
                    <div className="db-event-actions">
                      <span className="db-event-guests-badge">{event._count.guests} guests</span>
                      <DeleteEventButton eventId={event.id} />
                      <Link href={`/client/events/${event.id}`} className="text-gray-400 hover:text-[#0D4F4F] transition">
                        <ArrowRight size={15} />
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ─── Right Panel ─── */}
        <div className="db-right-panel">
          <div className="db-panel-card">
            <div className="db-panel-title">
              <Zap size={16} className="text-[#C07A20]" />
              Quick Links
            </div>
            {quickLinks.map((link) => (
              <Link key={link.label} href={link.href} className="db-quick-link">
                <link.icon size={15} />
                {link.label}
              </Link>
            ))}
          </div>

          <div className="db-panel-card">
            <div className="db-panel-title">
              <Heart size={16} className="text-[#E8A598]" />
              Need Help?
            </div>
            {helpItems.map((item, index) => (
              <div key={index} className="db-help-item">
                <div className="db-help-icon">
                  <item.icon size={14} />
                </div>
                {item.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}