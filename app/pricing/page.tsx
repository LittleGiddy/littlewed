'use client';

import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Menu, X, Wand, Mail, Bell, CheckCircle2, ShieldCheck,
  MessageCircle, Phone, Users, LayoutDashboard, ArrowRight, HeartHandshake
} from 'lucide-react';

const formatTZS = (n: number) => n.toLocaleString('en-TZ');

function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0]?.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [inView]);

  return { ref, inView };
}

function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal ${inView ? 'visible' : ''} ${className}`.trim()}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
    >
      {children}
    </div>
  );
}

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
      desc: 'Send polite reminder messages before the event and heartfelt thank-you cards after - to the guests who attended.',
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
        .nav { position: relative; z-index: 40; background: rgba(255,255,255,0.92); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); box-shadow: 0 2px 14px rgba(13,79,79,0.06); animation: fadeDown 0.5s cubic-bezier(0.16,1,0.3,1) backwards; }
        .nav-inner { max-width: 1080px; margin: 0 auto; padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; }
        .nav-left { display: flex; align-items: center; gap: 10px; }
        .nav-links { display: flex; align-items: center; gap: 26px; }
        .nav-links .nav-link { position: relative; font-weight: 600; font-size: 14.5px; color: #4A6072; }
        .nav-links .nav-link::after { content: ''; position: absolute; bottom: -4px; left: 0; width: 0; height: 2px; background: #0D4B4B; transition: width 0.3s; }
        .nav-links .nav-link:hover { color: #0D4B4B; }
        .nav-links .nav-link:hover::after { width: 100%; }
        .btn { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; border-radius: 12px; padding: 11px 20px; cursor: pointer; border: none; transition: all 0.2s; }
        .btn-primary { background: #0D4B4B; color: #fff; }
        .btn-primary:hover { background: #0A3939; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(13,75,75,0.3); }
        .mobile-btn { display: none; background: none; border: none; color: #0D4B4B; cursor: pointer; padding: 8px; border-radius: 8px; transition: background 0.2s; }
        .mobile-btn:hover { background: rgba(13,75,75,0.08); }
        .mobile-menu { display: none; }
        .mobile-menu.open { display: flex; flex-direction: column; position: absolute; top: calc(100% + 8px); left: 14px; right: 14px; background: #fff; border-radius: 16px; box-shadow: 0 12px 30px rgba(0,0,0,0.12); padding: 10px; z-index: 60; animation: menuIn 0.28s cubic-bezier(0.16,1,0.3,1) both; }
        .mobile-menu .nav-link { padding: 12px 16px; border-radius: 10px; color: #4A6072; font-weight: 600; font-size: 14px; transition: color 0.2s, background 0.2s; }
        .mobile-menu .nav-link:hover { color: #0D4B4B; background: rgba(13,75,75,0.06); }
        .mobile-menu .btn { margin: 6px 2px 4px; justify-content: center; }

        .hero { position: relative; overflow: hidden; text-align: center; padding: 84px 20px 48px; max-width: 760px; margin: 0 auto; }
        .hero::before, .hero::after { content: ''; position: absolute; border-radius: 50%; filter: blur(70px); pointer-events: none; }
        .hero::before { width: 320px; height: 320px; background: rgba(13,75,75,0.10); top: -90px; left: -70px; animation: float 12s ease-in-out infinite; }
        .hero::after { width: 260px; height: 260px; background: rgba(255,107,92,0.14); bottom: -110px; right: -50px; animation: float 16s ease-in-out 2s infinite; }
        .hero-badge { position: relative; display: inline-flex; align-items: center; gap: 8px; background: #fff; border: 1px solid rgba(13,75,75,0.12); color: #0D4B4B; font-weight: 700; font-size: 13px; padding: 7px 16px; border-radius: 999px; animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) backwards; }
        .hero h1 { position: relative; font-size: clamp(30px, 5vw, 48px); font-weight: 900; line-height: 1.1; color: #102A2A; margin: 20px 0 14px; animation: fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s backwards; }
        .hero h1 span { color: #FF6B5C; }
        .hero p { position: relative; font-size: 17px; color: #5A7186; line-height: 1.6; max-width: 560px; margin: 0 auto; animation: fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s backwards; }

        .plans { max-width: 900px; margin: 24px auto 0; padding: 0 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
        .plan { background: #fff; border: 1px solid #E6EDF2; border-radius: 22px; padding: 30px 28px; position: relative; display: flex; flex-direction: column; box-shadow: 0 10px 30px rgba(13,79,79,0.06); transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .plan:hover { transform: translateY(-6px); box-shadow: 0 18px 44px rgba(13,79,79,0.12); }
        .plan.featured { border: 2px solid #FF6B5C; box-shadow: 0 18px 42px rgba(255,107,92,0.16); }
        .plan.featured:hover { box-shadow: 0 22px 52px rgba(255,107,92,0.24); }
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

        .services { position: relative; max-width: 1080px; margin: 80px auto 0; padding: 0 20px; }
        .services-head { text-align: center; margin-bottom: 36px; }
        .services-head h2 { font-size: clamp(26px, 4vw, 36px); font-weight: 900; color: #102A2A; }
        .services-head p { color: #5A7186; max-width: 540px; margin: 12px auto 0; }
        .services-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
        .service { background: #fff; border: 1px solid #E6EDF2; border-radius: 18px; padding: 24px; transition: transform 0.25s ease, box-shadow 0.25s ease; }
        .service:hover { transform: translateY(-4px); box-shadow: 0 14px 34px rgba(13,79,79,0.10); }
        .service-icon { width: 44px; height: 44px; border-radius: 13px; background: rgba(13,75,75,0.08); color: #0D4B4B; display: flex; align-items: center; justify-content: center; margin-bottom: 14px; }
        .service h3 { font-size: 16px; font-weight: 800; color: #102A2A; margin-bottom: 6px; }
        .service p { font-size: 14px; color: #5A7186; line-height: 1.6; }

        .cta-strip { max-width: 900px; margin: 80px auto 40px; padding: 40px; background: linear-gradient(135deg, #0D4B4B, #0A3939); border-radius: 26px; text-align: center; color: #fff; box-shadow: 0 20px 50px rgba(13,79,79,0.25); }
        .cta-strip h2 { font-size: clamp(24px, 4vw, 34px); font-weight: 900; }
        .cta-strip p { opacity: 0.85; margin: 10px auto 22px; max-width: 460px; }
        .cta-strip .btn-primary { background: #FF6B5C; }
        .cta-strip .btn-primary:hover { background: #f25547; }

        .footer { max-width: 1080px; margin: 48px auto 0; padding: 20px 24px 28px; border-top: 1px solid #E8EEF2; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 14px; }
        .footer-brand { display: flex; align-items: center; gap: 6px; color: #7A8FA6; font-size: 12px; font-weight: 500; }
        .footer-brand strong { color: #0D4B4B; font-weight: 700; }
        .footer-heart { color: #FF6B5C; }
        .footer-links { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .footer-link { color: #9BAAB8; text-decoration: none; font-size: 12px; font-weight: 500; transition: color 0.2s; display: inline-flex; align-items: center; gap: 5px; }
        .footer-link:hover { color: #0D4B4B; }
        .footer-sep { color: #DCE4EA; font-weight: 300; }

        .reveal { opacity: 0; }
        .reveal.visible { opacity: 1; animation: fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) backwards; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeDown { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes menuIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float {
          0%,100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(14px,-18px) scale(1.05); }
          66% { transform: translate(-10px,12px) scale(0.95); }
        }

        @media (max-width: 900px) {
          .services-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .nav-links { display: none; }
          .mobile-btn { display: flex; align-items: center; justify-content: center; }
          .plans { grid-template-columns: 1fr; }
          .hero { padding: 52px 20px 28px; }
          .footer { justify-content: center; text-align: center; }
          .footer-links { justify-content: center; }
        }
        @media (max-width: 560px) {
          .services-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── Navbar ── */}
      <header className="nav">
        <div className="nav-inner">
          <Link href="/" className="nav-left">
            <img src="/Little Wed Logo.svg" alt="LittleWed" style={{ height: 34, width: 'auto', display: 'block' }} />
          </Link>
          <nav className="nav-links">
            <Link href="/login" className="nav-link">Login</Link>
            <Link href="/pricing" className="nav-link">Pricing</Link>
            <Link href="/signup" className="btn btn-primary">Get Started</Link>
          </nav>
          <button
            className="mobile-btn"
            onClick={() => setMobileMenuOpen(o => !o)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {mobileMenuOpen && (
          <nav className="mobile-menu open">
            <Link href="/login" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Login</Link>
            <Link href="/pricing" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Pricing</Link>
            <Link href="/signup" className="btn btn-primary" onClick={() => setMobileMenuOpen(false)}>Get Started</Link>
          </nav>
        )}
      </header>

      {/* ── Hero ── */}
      <section className="hero">
        <span className="hero-badge"><HeartHandshake size={15} /> Simple, fair pricing</span>
        <h1>Beautiful weddings & events, <span>without surprise fees</span></h1>
        <p>
          Pay per guest or per invite. No subscription traps - just the tools you need to
          invite, manage, and check in your guests.
        </p>
      </section>

      {/* ── Plans ── */}
      <section className="plans">
        {plans.map((plan, i) => (
          <Reveal
            key={plan.slug}
            className={`plan ${plan.slug === 'wedding' ? 'featured' : ''}`}
            delay={0.08 + i * 0.1}
          >
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
          </Reveal>
        ))}
      </section>

      {/* ── Services ── */}
      <section className="services">
        <Reveal>
          <div className="services-head">
            <h2>Everything you need, in one place</h2>
            <p>From the invitation to the thank-you card, LittleWed handles the guest experience end to end.</p>
          </div>
        </Reveal>
        <div className="services-grid">
          {services.map((s, i) => (
            <Reveal key={s.title} className="service" delay={i * 0.06}>
              <div className="service-icon">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <Reveal className="cta-strip">
        <h2>Ready to get started?</h2>
        <p>Create your account in minutes and invite your first guest today.</p>
        <Link href="/signup" className="btn btn-primary"><Wand size={16} /> Get Started Free</Link>
      </Reveal>

      {/* ── Footer ── */}
      <footer className="footer">
        <div className="footer-brand">
          <span>© {new Date().getFullYear()}</span>
          <strong>LittleWed</strong>
          <span className="footer-heart">♥</span>
          <span>by <strong>MAHIRI GLOBAL LTD</strong></span>
        </div>
        <div className="footer-links">
          <Link href="/about" className="footer-link">About</Link>
          <span className="footer-sep">|</span>
          <Link href="/pricing" className="footer-link">Pricing</Link>
          <span className="footer-sep">|</span>
          <Link href="/privacy-policy" className="footer-link">Privacy</Link>
          <span className="footer-sep">|</span>
          <Link href="/data-deletion" className="footer-link">Data Deletion</Link>
          <span className="footer-sep">|</span>
          <span className="footer-link"><Phone size={12} /> +255 702 529 514</span>
        </div>
      </footer>
    </div>
  );
}