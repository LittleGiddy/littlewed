'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Menu, X, Heart, Sparkles, Mail, Bell, CheckCircle2, ShieldCheck,
  MessageCircle, Phone, Users, LayoutDashboard, ArrowRight, HeartHandshake
} from 'lucide-react';

const formatTZS = (n: number) => n.toLocaleString('en-TZ');

export default function PricingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 768) setMobileMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const plans = [
    {
      slug: 'wedding',
      badge: 'Most Popular',
      title: 'Wedding Owners',
      tagline: 'For couples and families planning their own wedding.',
      price: 1500,
      unit: 'per guest',
      features: [
        'Unlimited invitation cards (WhatsApp, SMS, print)',
        'QR code check-in with live guest list',
        'Guest management & RSVP tracking',
        'Reminder messages to your guests',
        'Thanks cards after the event',
        'Free support throughout',
      ],
      cta: 'Plan My Wedding',
    },
    {
      slug: 'planner',
      badge: null,
      title: 'Event Planners',
      tagline: 'For professionals who plan weddings at scale.',
      price: 500,
      unit: 'per invite',
      features: [
        'Everything in Wedding Owners',
        'Manage multiple events & clients',
        'Staff accounts for on-the-day teams',
        'Bulk invitations & guest imports',
        'Client dashboards & reports',
        'Priority support',
      ],
      cta: 'Start With Events',
    },
  ];

  const services = [
    {
      icon: <MessageCircle size={20} />,
      title: 'Smart Invitations',
      desc: 'Send beautiful invitations over WhatsApp and SMS with live delivery tracking, so you know every guest was reached.',
    },
    {
      icon: <LayoutDashboard size={20} />,
      title: 'Live Guest Dashboard',
      desc: 'Track RSVPs, manage your guest list, and add guests in seconds from one clean dashboard.',
    },
    {
      icon: <Users size={20} />,
      title: 'QR Check-in',
      desc: 'Scan QR codes at the door with a phone or staff device. The guest list updates in real time.',
    },
    {
      icon: <Bell size={20} />,
      title: 'Reminders & Thanks',
      desc: 'Send polite reminder messages before the event and heartfelt thank-you cards after — to the guests who attended.',
    },
    {
      icon: <Mail size={20} />,
      title: 'Email Notifications',
      desc: 'Get important updates and alerts delivered straight to your inbox and notifications in the app.',
    },
    {
      icon: <ShieldCheck size={20} />,
      title: 'Secure & Reliable',
      desc: 'Your guest information is kept private and protected. Built for peace of mind on your big day.',
    },
  ];

  return (
    <div className="pricing-page" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F5F8FA; }
        .pricing-page { min-height: 100dvh; background: #F5F8FA; color: #243B53; }
        a { text-decoration: none; color: inherit; }
        .nav { position: sticky; top: 0; z-index: 40; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); box-shadow: 0 2px 14px rgba(13,79,79,0.06); }
        .nav-inner { max-width: 1080px; margin: 0 auto; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; }
        .nav-left { display: flex; align-items: center; gap: 10px; }
        .logo-mark { width: 36px; height: 36px; border-radius: 12px; background: linear-gradient(135deg, #0D4B4B, #0A3939); display: flex; align-items: center; justify-content: center; color: white; }
        .logo-text { font-weight: 800; font-size: 18px; color: #0D4B4B; letter-spacing: -0.2px; }
        .nav-links { display: flex; align-items: center; gap: 24px; }
        .nav-links a { font-weight: 600; font-size: 14px; color: #3A5670; }
        .nav-links a:hover { color: #0D4B4B; }
        .btn { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; border-radius: 12px; padding: 11px 20px; cursor: pointer; border: none; transition: all 0.2s; }
        .btn-primary { background: #0D4B4B; color: #fff; }
        .btn-primary:hover { background: #0A3939; }
        .btn-ghost { background: transparent; color: #0D4B4B; }
        .mobile-btn { display: none; }
        .mobile-menu-out { display: none; }

        .hero { text-align: center; padding: 72px 20px 40px; max-width: 760px; margin: 0 auto; }
        .hero-badge { display: inline-flex; align-items: center; gap: 8px; background: #fff; border: 1px solid rgba(13,75,75,0.12); color: #0D4B4B; font-weight: 700; font-size: 13px; padding: 7px 16px; border-radius: 999px; }
        .hero h1 { font-size: clamp(30px, 5vw, 48px); font-weight: 900; line-height: 1.1; color: #102A2A; margin: 20px 0 14px; }
        .hero h1 span { color: #FF6B5C; }
        .hero p { font-size: 17px; color: #5A7186; line-height: 1.6; max-width: 560px; margin: 0 auto; }

        .plans { max-width: 900px; margin: 24px auto 0; padding: 0 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
        .plan { background: #fff; border: 1px solid #E6EDF2; border-radius: 22px; padding: 30px 28px; position: relative; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(13,79,79,0.06); }
        .plan.featured { border: 2px solid #FF6B5C; box-shadow: 0 18px 42px rgba(255,107,92,0.16); }
        .plan-badge { position: absolute; top: -13px; left: 26px; background: #FF6B5C; color: #fff; font-size: 11px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; padding: 5px 14px; border-radius: 999px; }
        .plan-cat { font-size: 12px; font-weight: 800; letter-spacing: 1.2px; text-transform: uppercase; color: #0D4B4B; }
        .plan-title { font-size: 24px; font-weight: 900; color: #102A2A; margin: 6px 0; }
        .plan-tagline { font-size: 14px; color: #5A7186; line-height: 1.5; margin-bottom: 18px; }
        .plan-price { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
        .plan-price .amount { font-size: 44px; font-weight: 900; color: #102A2A; }
        .plan-price .small { font-size: 14px; color: #8AA0B5; }
        .plan-price .currency { position: relative; top: -16px; font-size: 16px; font-weight: 700; color: #0D4B4B; }
        .plan-features { list-style: none; margin: 20px 0 24px; flex: 1; }
        .plan-features li { display: flex; gap: 10px; align-items: flex-start; font-size: 14px; color: #3A5670; padding: 6px 0; }
        .plan-features li svg { color: #0D4B4B; flex-shrink: 0; margin-top: 1px; }
        .plan .btn { justify-content: center; width: 100%; }

        .services { max-width: 1080px; margin: 80px auto 0; padding: 0 20px; }
        .services-head { text-align: center; margin-bottom: 36px; }
        .services-head h2 { font-size: clamp(26px, 4vw, 36px); font-weight: 900; color: #102A2A; }
        .services-head p { color: #5A7186; max-width: 540px; margin: 12px auto 0; }
        .services-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .service { background: #fff; border: 1px solid #E6EDF2; border-radius: 18px; padding: 24px; }
        .service-icon { width: 44px; height: 44px; border-radius: 13px; background: rgba(13,75,75,0.08); color: #0D4B4B; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .service h3 { font-size: 16px; font-weight: 800; color: #102A2A; margin-bottom: 6px; }
        .service p { font-size: 14px; color: #5A7186; line-height: 1.6; }

        .cta-strip { max-width: 900px; margin: 80px auto 40px; padding: 40px; background: linear-gradient(135deg, #0D4B4B, #0A3939); border-radius: 26px; text-align: center; color: #fff; box-shadow: 0 20px 50px rgba(13,79,79,0.25); }
        .cta-strip h2 { font-size: clamp(24px, 4vw, 34px); font-weight: 900; }
        .cta-strip p { opacity: 0.85; margin: 10px auto 22px; max-width: 460px; }
        .cta-strip .btn-primary { background: #FF6B5C; }
        .cta-strip .btn-primary:hover { background: #f25547; }

        .footer { text-align: center; padding: 24px 20px 36px; color: #8AA0B5; font-size: 13px; }

        @media (max-width: 900px) {
          .services-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .nav-links { display: none; }
          .mobile-btn { display: flex; }
          .mobile-menu-out { display: block; background: #fff; border-radius: 14px; box-shadow: 0 12px 30px rgba(0,0,0,0.12); padding: 8px 0; margin: 0 14px; }
          .mobile-menu-out.hidden { display: none; }
          .mobile-menu-out a { display: block; padding: 12px 18px; font-weight: 700; font-size: 15px; color: #243B53; border-radius: 10px; }
          .mobile-menu-out a:hover { background: rgba(13,75,75,0.06); }
          .mobile-menu-out .btn { margin: 6px 12px 12px; justify-content: center; width: calc(100% - 24px); }
          .plans { grid-template-columns: 1fr; }
          .hero { padding: 48px 20px 24px; }
        }
        @media (max-width: 560px) {
          .services-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <header className="nav">
        <div className="nav-inner">
          <Link href="/" className="nav-left">
            <span className="logo-mark"><Heart size={18} fill="currentColor" /></span>
            <span className="logo-text">LittleWed</span>
          </Link>
          <nav className="nav-links">
            <Link href="/login">Login</Link>
            <Link href="/pricing">Pricing</Link>
            <Link href="/signup" className="btn btn-primary">Get Started</Link>
          </nav>
          <button
            className="btn btn-ghost mobile-btn"
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <nav className={`mobile-menu-out ${mobileMenuOpen ? '' : 'hidden'}`}>
            <a href="/login">Login</a>
            <a href="/signup" className="btn btn-primary">Get Started</a>
          </nav>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="hero">
        <span className="hero-badge"><HeartHandshake size={15} /> Simple, fair pricing</span>
        <h1>Beautiful weddings & events, <span>without surprise fees</span></h1>
        <p>
          Pay per guest or per invite. No subscription traps — just the tools you need to
          invite, manage, and check in your guests.
        </p>
      </section>

      {/* ── Plans ── */}
      <section className="plans">
        {plans.map(plan => (
          <div key={plan.slug} className={`plan ${plan.slug === 'wedding' ? 'featured' : ''}`}>
            {plan.badge && <span className="plan-badge">{plan.badge}</span>}
            <div className="plan-cat">{plan.slug === 'wedding' ? 'Wedding Owners' : 'Event Planners'}</div>
            <h2 className="plan-title">{plan.title}</h2>
            <p className="plan-tagline">{plan.tagline}</p>
            <div className="plan-price">
              <span className="currency">TZS</span>
              <span className="amount">{formatTZS(plan.price)}</span>
              <span className="small">/ {plan.unit}</span>
            </div>
            <ul className="plan-features">
              {plan.features.map(f => (
                <li key={f}><CheckCircle2 size={18} /> {f}</li>
              ))}
            </ul>
            <Link href="/signup" className="btn btn-primary" style={{ background: plan.slug === 'wedding' ? '#0D4B4B' : undefined, color: plan.slug === 'wedding' ? '#fff' : undefined }}>
              {plan.cta} <ArrowRight size={16} />
            </Link>
          </div>
        ))}
      </section>

      {/* ── Services ── */}
      <section className="services">
        <div className="services-head">
          <h2>Everything you need, in one place</h2>
          <p>From the invitation to the thank-you card, LittleWed handles the guest experience end to end.</p>
        </div>
        <div className="services-grid">
          {services.map(s => (
            <div key={s.title} className="service">
              <div className="service-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-strip">
        <h2>Ready to get started?</h2>
        <p>Create your account in minutes and invite your first guest today.</p>
        <Link href="/signup" className="btn btn-primary"><Sparkles size={16} /> Get Started Free</Link>
      </section>

      <footer className="footer">
        © {new Date().getFullYear()} LittleWed · Wedding Management Platform · <Phone size={12} style={{ verticalAlign: 'middle' }} /> +255 702 529 514
      </footer>
    </div>
  );
}
