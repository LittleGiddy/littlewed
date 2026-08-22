'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X, Sparkles, Zap, Users, Building, Calendar, MessageCircle, QrCode, Mail, Globe, Shield, Crown, ArrowRight, Menu, X as XClose, ChevronDown } from 'lucide-react';

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const Logo = () => (
    <img
      src="/Little Wed Logo.svg"
      alt="Little Wed"
      style={{
        display: 'block',
        width: '130px',
        height: 'auto',
      }}
    />
  );

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/about', label: 'About' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/contact', label: 'Contact' },
  ];

  const plans = [
    {
      name: 'Starter',
      icon: <Sparkles size={20} />,
      price: 29,
      description: 'Perfect for small events and gatherings',
      features: [
        { included: true, text: 'Up to 50 guests' },
        { included: true, text: 'WhatsApp & SMS invitations' },
        { included: true, text: 'QR code check-in' },
        { included: true, text: 'Basic guest management' },
        { included: true, text: 'Email support' },
        { included: false, text: 'Custom invitation cards' },
        { included: false, text: 'Real-time dashboard' },
        { included: false, text: 'Priority support' },
        { included: false, text: 'Advanced analytics' },
        { included: false, text: 'Multiple events' },
      ],
      cta: 'Get Started',
      popular: false,
    },
    {
      name: 'Professional',
      icon: <Zap size={20} />,
      price: 59,
      description: 'Ideal for growing events and businesses',
      features: [
        { included: true, text: 'Up to 200 guests' },
        { included: true, text: 'WhatsApp & SMS invitations' },
        { included: true, text: 'QR code check-in' },
        { included: true, text: 'Advanced guest management' },
        { included: true, text: 'Custom invitation cards' },
        { included: true, text: 'Real-time dashboard' },
        { included: true, text: 'Email & chat support' },
        { included: false, text: 'Priority support' },
        { included: false, text: 'Advanced analytics' },
        { included: false, text: 'Multiple events' },
      ],
      cta: 'Get Started',
      popular: true,
    },
    {
      name: 'Enterprise',
      icon: <Crown size={20} />,
      price: 99,
      description: 'For large events and organizations',
      features: [
        { included: true, text: 'Unlimited guests' },
        { included: true, text: 'WhatsApp & SMS invitations' },
        { included: true, text: 'QR code check-in' },
        { included: true, text: 'Advanced guest management' },
        { included: true, text: 'Custom invitation cards' },
        { included: true, text: 'Real-time dashboard' },
        { included: true, text: 'Priority support' },
        { included: true, text: 'Advanced analytics' },
        { included: true, text: 'Multiple events' },
        { included: true, text: 'Dedicated account manager' },
      ],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  const features = [
    {
      icon: <MessageCircle size={18} />,
      title: 'WhatsApp & SMS',
      description: 'Send invitations via WhatsApp and SMS with automated reminders',
    },
    {
      icon: <QrCode size={18} />,
      title: 'QR Code Check-in',
      description: 'Instant check-in with QR codes for a seamless guest experience',
    },
    {
      icon: <Users size={18} />,
      title: 'Guest Management',
      description: 'Easily manage guest lists, RSVPs, and seating arrangements',
    },
    {
      icon: <Building size={18} />,
      title: 'Custom Cards',
      description: 'Design professional invitation cards with your branding',
    },
    {
      icon: <Globe size={18} />,
      title: 'Real-time Dashboard',
      description: 'Track attendance and engagement in real-time',
    },
    {
      icon: <Shield size={18} />,
      title: 'Secure & Reliable',
      description: 'Enterprise-grade security and 99.9% uptime guarantee',
    },
  ];

  const faqs = [
    {
      question: 'What payment methods do you accept?',
      answer: 'We accept all major credit cards (Visa, Mastercard, American Express) and PayPal. For Enterprise plans, we also offer invoice payments.',
    },
    {
      question: 'Can I upgrade or downgrade my plan later?',
      answer: 'Yes, you can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.',
    },
    {
      question: 'Is there a free trial?',
      answer: 'Yes, we offer a 14-day free trial on all plans. No credit card required to start.',
    },
    {
      question: 'What happens if I exceed my guest limit?',
      answer: 'We\'ll notify you when you\'re approaching your limit. You can upgrade your plan at any time to accommodate more guests.',
    },
    {
      question: 'Do you offer custom pricing for non-profits?',
      answer: 'Yes, we offer special pricing for non-profit organizations. Please contact our sales team for more information.',
    },
    {
      question: 'Can I cancel my subscription anytime?',
      answer: 'Yes, you can cancel your subscription at any time. No long-term contracts or hidden fees.',
    },
  ];

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ fontFamily: "'DM Sans', 'Segoe UI', sans-serif", background: '#F5F8FA' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .pricing-page {
          min-height: 100vh;
        }

        /* ── Navigation ── */
        .nav {
          background: white;
          border-bottom: 1px solid #E8EEF2;
          padding: 16px 32px;
          position: sticky;
          top: 0;
          z-index: 100;
        }

        .nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .nav-left {
          display: flex;
          align-items: center;
        }

        .nav-desktop {
          display: flex;
          gap: 32px;
          align-items: center;
        }

        .nav-link {
          color: #4A6072;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: color 0.2s;
          position: relative;
        }

        .nav-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: #0D4F4F;
          transition: width 0.3s;
        }

        .nav-link:hover {
          color: #0D4F4F;
        }

        .nav-link:hover::after {
          width: 100%;
        }

        .nav-link.active {
          color: #0D4F4F;
        }

        .nav-link.active::after {
          width: 100%;
        }

        .nav-link.cta {
          background: #0D4F4F;
          color: white;
          padding: 10px 24px;
          border-radius: 24px;
          font-weight: 600;
        }

        .nav-link.cta::after {
          display: none;
        }

        .nav-link.cta:hover {
          background: #0A3D3D;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(13,79,79,0.3);
        }

        .mobile-menu-btn {
          display: none;
          background: none;
          border: none;
          color: #0D4F4F;
          cursor: pointer;
          padding: 8px;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .mobile-menu-btn:hover {
          background: rgba(13,79,79,0.08);
        }

        .mobile-menu {
          display: none;
          flex-direction: column;
          gap: 4px;
          padding: 16px 0;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.08);
          margin-top: 8px;
          position: absolute;
          top: 100%;
          left: 16px;
          right: 16px;
          z-index: 50;
        }

        .mobile-menu.open {
          display: flex;
        }

        .mobile-menu .nav-link {
          padding: 12px 16px;
          border-radius: 8px;
        }

        .mobile-menu .nav-link:hover {
          background: rgba(13,79,79,0.06);
        }

        .mobile-menu .nav-link.cta {
          margin: 4px 16px;
          text-align: center;
        }

        /* ── Hero ── */
        .hero {
          text-align: center;
          padding: 60px 24px 40px;
          background: linear-gradient(160deg, #0D4F4F 0%, #0A3D3D 100%);
          color: white;
          position: relative;
          overflow: hidden;
        }

        .hero::before {
          content: '';
          position: absolute;
          top: -50%;
          right: -20%;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: rgba(232,165,152,0.05);
          animation: floatA 15s ease-in-out infinite;
        }

        .hero::after {
          content: '';
          position: absolute;
          bottom: -40%;
          left: -10%;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background: rgba(232,165,152,0.03);
          animation: floatB 12s ease-in-out infinite;
        }

        @keyframes floatA {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(30px,-30px) scale(1.05); }
        }

        @keyframes floatB {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(-20px,20px) scale(1.08); }
        }

        .hero-content {
          position: relative;
          z-index: 1;
          max-width: 700px;
          margin: 0 auto;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.1);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.15);
          padding: 6px 16px 6px 12px;
          border-radius: 50px;
          color: rgba(255,255,255,0.85);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
          margin-bottom: 20px;
        }

        .hero-title {
          font-family: 'Playfair Display', serif;
          font-size: 48px;
          font-weight: 900;
          line-height: 1.1;
          margin-bottom: 16px;
        }

        .hero-title span {
          color: #E8A598;
        }

        .hero-sub {
          color: rgba(255,255,255,0.6);
          font-size: 18px;
          line-height: 1.6;
          max-width: 500px;
          margin: 0 auto;
        }

        /* ── Billing Toggle ── */
        .billing-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          padding: 20px 0;
          background: white;
          border-bottom: 1px solid #E8EEF2;
        }

        .billing-toggle span {
          font-size: 14px;
          font-weight: 500;
          color: #4A6072;
        }

        .billing-toggle span.active {
          color: #0D4F4F;
        }

        .toggle-switch {
          width: 56px;
          height: 30px;
          background: #E2EAF0;
          border-radius: 15px;
          cursor: pointer;
          position: relative;
          transition: background 0.3s;
          flex-shrink: 0;
        }

        .toggle-switch.active {
          background: #0D4F4F;
        }

        .toggle-switch .toggle-dot {
          width: 24px;
          height: 24px;
          background: white;
          border-radius: 50%;
          position: absolute;
          top: 3px;
          left: 3px;
          transition: transform 0.3s;
          box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        }

        .toggle-switch.active .toggle-dot {
          transform: translateX(26px);
        }

        .save-badge {
          background: #E8F5F2;
          color: #0D4F4F;
          font-size: 11px;
          font-weight: 700;
          padding: 2px 10px;
          border-radius: 12px;
          letter-spacing: 0.3px;
        }

        /* ── Pricing Grid ── */
        .pricing-grid {
          max-width: 1200px;
          margin: 0 auto;
          padding: 40px 24px 60px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
        }

        .pricing-card {
          background: white;
          border-radius: 20px;
          padding: 32px 28px;
          border: 1px solid #E8EEF2;
          transition: all 0.3s;
          position: relative;
          display: flex;
          flex-direction: column;
        }

        .pricing-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.08);
        }

        .pricing-card.popular {
          border-color: #0D4F4F;
          box-shadow: 0 8px 32px rgba(13,79,79,0.12);
        }

        .pricing-card.popular:hover {
          box-shadow: 0 12px 48px rgba(13,79,79,0.18);
        }

        .popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: #0D4F4F;
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 4px 16px;
          border-radius: 20px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .plan-icon {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(13,79,79,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0D4F4F;
          margin-bottom: 16px;
        }

        .plan-name {
          font-size: 20px;
          font-weight: 700;
          color: #0D1B1B;
          margin-bottom: 4px;
        }

        .plan-description {
          font-size: 14px;
          color: #7A8FA6;
          margin-bottom: 20px;
        }

        .plan-price {
          font-size: 42px;
          font-weight: 800;
          color: #0D1B1B;
          margin-bottom: 4px;
        }

        .plan-price span {
          font-size: 16px;
          font-weight: 500;
          color: #7A8FA6;
        }

        .plan-billing {
          font-size: 13px;
          color: #7A8FA6;
          margin-bottom: 24px;
        }

        .plan-features {
          flex: 1;
          list-style: none;
          padding: 0;
          margin: 0 0 24px;
        }

        .plan-features li {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 0;
          font-size: 14px;
          color: #4A6072;
        }

        .plan-features .check {
          color: #0D4F4F;
          flex-shrink: 0;
        }

        .plan-features .x {
          color: #C8D4DE;
          flex-shrink: 0;
        }

        .plan-cta {
          padding: 14px;
          border: none;
          border-radius: 12px;
          font-size: 15px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.3s;
          width: 100%;
          text-align: center;
          text-decoration: none;
          display: block;
        }

        .plan-cta.primary {
          background: #0D4F4F;
          color: white;
        }

        .plan-cta.primary:hover {
          background: #0A3D3D;
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(13,79,79,0.3);
        }

        .plan-cta.outline {
          background: transparent;
          color: #0D4F4F;
          border: 2px solid #0D4F4F;
        }

        .plan-cta.outline:hover {
          background: rgba(13,79,79,0.06);
        }

        .plan-cta.popular {
          background: #0D4F4F;
          color: white;
          box-shadow: 0 4px 16px rgba(13,79,79,0.3);
        }

        .plan-cta.popular:hover {
          background: #0A3D3D;
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(13,79,79,0.4);
        }

        /* ── Features Section ── */
        .features-section {
          background: white;
          padding: 60px 24px;
          border-top: 1px solid #E8EEF2;
        }

        .features-section-inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        .section-header {
          text-align: center;
          max-width: 600px;
          margin: 0 auto 48px;
        }

        .section-header h2 {
          font-family: 'Playfair Display', serif;
          font-size: 36px;
          font-weight: 800;
          color: #0D1B1B;
          margin-bottom: 12px;
        }

        .section-header p {
          color: #7A8FA6;
          font-size: 16px;
          line-height: 1.6;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
        }

        .feature-card {
          text-align: center;
          padding: 24px;
        }

        .feature-icon {
          width: 56px;
          height: 56px;
          border-radius: 14px;
          background: rgba(13,79,79,0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0D4F4F;
          margin: 0 auto 16px;
        }

        .feature-card h3 {
          font-size: 16px;
          font-weight: 700;
          color: #0D1B1B;
          margin-bottom: 8px;
        }

        .feature-card p {
          font-size: 14px;
          color: #7A8FA6;
          line-height: 1.6;
        }

        /* ── FAQ Section ── */
        .faq-section {
          max-width: 800px;
          margin: 0 auto;
          padding: 60px 24px;
        }

        .faq-section h2 {
          font-family: 'Playfair Display', serif;
          font-size: 36px;
          font-weight: 800;
          color: #0D1B1B;
          text-align: center;
          margin-bottom: 40px;
        }

        .faq-item {
          border-bottom: 1px solid #E8EEF2;
          padding: 16px 0;
        }

        .faq-question {
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          padding: 8px 0;
          font-size: 16px;
          font-weight: 600;
          color: #0D1B1B;
          background: none;
          border: none;
          width: 100%;
          text-align: left;
          font-family: inherit;
          transition: color 0.2s;
        }

        .faq-question:hover {
          color: #0D4F4F;
        }

        .faq-answer {
          max-height: 0;
          overflow: hidden;
          transition: max-height 0.3s ease, padding 0.3s ease;
          color: #7A8FA6;
          font-size: 14px;
          line-height: 1.6;
        }

        .faq-answer.open {
          max-height: 200px;
          padding: 12px 0 4px;
        }

        .faq-icon {
          color: #0D4F4F;
          flex-shrink: 0;
          transition: transform 0.3s;
        }

        .faq-icon.open {
          transform: rotate(180deg);
        }

        /* ── Footer ── */
        .footer {
          background: white;
          border-top: 1px solid #E8EEF2;
          padding: 32px 24px;
          text-align: center;
        }

        .footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #7A8FA6;
          font-size: 13px;
          font-weight: 500;
        }

        .footer-brand strong {
          color: #0D4F4F;
          font-weight: 700;
        }

        .footer-links {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }

        .footer-link {
          color: #9BAAB8;
          text-decoration: none;
          font-size: 13px;
          font-weight: 500;
          transition: color 0.2s;
        }

        .footer-link:hover {
          color: #0D4F4F;
        }

        .footer-heart {
          color: #E8A598;
        }

        /* ── Responsive ── */
        @media (max-width: 768px) {
          .nav {
            padding: 12px 16px;
          }

          .nav-desktop {
            display: none;
          }

          .mobile-menu-btn {
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .hero-title {
            font-size: 32px;
          }

          .hero-sub {
            font-size: 16px;
          }

          .pricing-grid {
            grid-template-columns: 1fr;
            padding: 24px 16px 40px;
            gap: 20px;
          }

          .pricing-card {
            padding: 24px 20px;
          }

          .plan-price {
            font-size: 36px;
          }

          .features-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }

          .features-section {
            padding: 40px 16px;
          }

          .section-header h2 {
            font-size: 28px;
          }

          .faq-section {
            padding: 40px 16px;
          }

          .faq-section h2 {
            font-size: 28px;
          }

          .footer-inner {
            flex-direction: column;
            text-align: center;
          }

          .footer-links {
            justify-content: center;
          }
        }

        @media (min-width: 769px) {
          .mobile-menu-btn {
            display: none;
          }

          .mobile-menu {
            display: none !important;
          }
        }

        @media (max-width: 480px) {
          .hero-title {
            font-size: 28px;
          }

          .hero {
            padding: 40px 16px 32px;
          }

          .plan-price {
            font-size: 32px;
          }

          .pricing-card {
            padding: 20px 16px;
          }
        }
      `}</style>

      <div className="pricing-page">
        {/* ── Navigation ── */}
        <nav className="nav">
          <div className="nav-inner">
            <div className="nav-left">
              <Logo />
            </div>

            <div className="nav-desktop">
              {navLinks.map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href} 
                  className={`nav-link ${link.label === 'Pricing' ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/login" className="nav-link">
                Sign In
              </Link>
              <Link href="/signup" className="nav-link cta">
                Get Started
              </Link>
            </div>

            <button 
              className="mobile-menu-btn"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <XClose size={24} /> : <Menu size={24} />}
            </button>

            <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
              {navLinks.map((link) => (
                <Link 
                  key={link.href} 
                  href={link.href} 
                  className={`nav-link ${link.label === 'Pricing' ? 'active' : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <Link href="/login" className="nav-link" onClick={() => setMobileMenuOpen(false)}>
                Sign In
              </Link>
              <Link href="/signup" className="nav-link cta" onClick={() => setMobileMenuOpen(false)}>
                Get Started
              </Link>
            </div>
          </div>
        </nav>

        {/* ── Hero ── */}
        <section className="hero">
          <div className="hero-content">
            <div className="hero-badge">
              <Sparkles size={14} />
              Simple, Transparent Pricing
            </div>
            <h1 className="hero-title">
              Choose the plan that <span>fits your event</span>
            </h1>
            <p className="hero-sub">
              Start with a 14-day free trial. No credit card required. 
              Cancel anytime.
            </p>
          </div>
        </section>

        {/* ── Billing Toggle ── */}
        <div className="billing-toggle">
          <span className={billingCycle === 'monthly' ? 'active' : ''}>Monthly</span>
          <div 
            className={`toggle-switch ${billingCycle === 'annual' ? 'active' : ''}`}
            onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
          >
            <div className="toggle-dot" />
          </div>
          <span className={billingCycle === 'annual' ? 'active' : ''}>Annual</span>
          <span className="save-badge">Save 20%</span>
        </div>

        {/* ── Pricing Cards ── */}
        <div className="pricing-grid">
          {plans.map((plan, index) => {
            const isPopular = plan.popular;
            const price = billingCycle === 'annual' ? Math.round(plan.price * 0.8) : plan.price;
            
            return (
              <div key={index} className={`pricing-card ${isPopular ? 'popular' : ''}`}>
                {isPopular && <div className="popular-badge">Most Popular</div>}
                
                <div className="plan-icon">{plan.icon}</div>
                <h3 className="plan-name">{plan.name}</h3>
                <p className="plan-description">{plan.description}</p>
                
                <div className="plan-price">
                  ${price}<span>/mo</span>
                </div>
                <div className="plan-billing">
                  {billingCycle === 'annual' ? 'Billed annually' : 'Billed monthly'}
                </div>

                <ul className="plan-features">
                  {plan.features.map((feature, idx) => (
                    <li key={idx}>
                      {feature.included ? (
                        <Check size={16} className="check" />
                      ) : (
                        <X size={16} className="x" />
                      )}
                      {feature.text}
                    </li>
                  ))}
                </ul>

                <Link 
                  href={plan.name === 'Enterprise' ? '/contact' : '/signup'} 
                  className={`plan-cta ${isPopular ? 'popular' : plan.name === 'Starter' ? 'outline' : 'primary'}`}
                >
                  {plan.cta}
                </Link>
              </div>
            );
          })}
        </div>

        {/* ── Features Section ── */}
        <section className="features-section">
          <div className="features-section-inner">
            <div className="section-header">
              <h2>Everything you need to <span style={{ color: '#0D4F4F' }}>manage your event</span></h2>
              <p>All plans include the core features you need to create an unforgettable experience.</p>
            </div>

            <div className="features-grid">
              {features.map((feature, index) => (
                <div key={index} className="feature-card">
                  <div className="feature-icon">{feature.icon}</div>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ Section ── */}
        <section className="faq-section">
          <h2>Frequently Asked Questions</h2>
          {faqs.map((faq, index) => (
            <div key={index} className="faq-item">
              <button 
                className="faq-question"
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
              >
                {faq.question}
                <ChevronDown size={20} className={`faq-icon ${openFaq === index ? 'open' : ''}`} />
              </button>
              <div className={`faq-answer ${openFaq === index ? 'open' : ''}`}>
                {faq.answer}
              </div>
            </div>
          ))}
        </section>

        {/* ── Footer ── */}
        <footer className="footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <span>© 2026</span>
              <strong>LittleWed</strong>
              <span className="footer-heart">♥</span>
              <span>by <strong>MAHIRI GLOBAL LTD</strong></span>
            </div>

            <div className="footer-links">
              <Link href="/about" className="footer-link">About</Link>
              <Link href="/pricing" className="footer-link">Pricing</Link>
              <Link href="/privacy-policy" className="footer-link">Privacy Policy</Link>
              <Link href="/data-deletion" className="footer-link">Data Deletion</Link>
              <Link href="/contact" className="footer-link">Contact</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}