'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Eye, EyeOff, ArrowRight, MessageCircle, ScanLine, LayoutDashboard, FileHeart, Menu, X, Heart, Building, User, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  
  // Google Sign-Up Flow States
  const [showOrgPrompt, setShowOrgPrompt] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [creatingOrg, setCreatingOrg] = useState(false);

  // Hero carousel content
  const heroSlides = [
    {
      image: '/Gemini_Generated_Image_shs33shs33shs33s.png',
      badge: 'For Couples & Planners',
      titleLine1: 'Weddings,',
      titleHighlight: 'Beautifully Managed',
      sub: 'Send invitations, track RSVPs, and check guests in all from one simple dashboard.',
      mobileSub: 'Invitations, RSVPs, and check-in — all in one place.',
    },
    {
      image: '/Gemini_Generated_Image_shs33shs33shs33s.png',
      badge: 'Invitations',
      titleLine1: 'Every guest,',
      titleHighlight: 'perfectly invited',
      sub: 'Reach every guest instantly with custom WhatsApp, SMS, and printable invitation cards.',
      mobileSub: 'Custom invitations sent over WhatsApp & SMS.',
    },
    {
      image: '/Gemini_Generated_Image_shs33shs33shs33s.png',
      badge: 'On The Day',
      titleLine1: 'Check-in,',
      titleHighlight: 'without the chaos',
      sub: 'Scan a QR code at the door and watch your guest list update in real time.',
      mobileSub: 'QR check-in that updates your guest list live.',
    },
  ];

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) return;

    const id = setInterval(() => {
      setActiveSlide((s) => (s + 1) % heroSlides.length);
    }, 6000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Check if user has a tenant ──────────────────────────────────────
  const checkUserTenant = async (session: any) => {
    try {
      const res = await fetch('/api/auth/check-tenant');
      const data = await res.json();
      
      if (data.hasTenant) {
        // User has a tenant, redirect to dashboard
        const role = session?.user?.role;
        if (role === 'SUPER_ADMIN') {
          window.location.href = '/admin/dashboard';
        } else if (role === 'STAFF') {
          window.location.href = '/client/staff/dashboard';
        } else {
          window.location.href = '/client/dashboard';
        }
      } else {
        // User needs to create an organization
        setGoogleUser(session?.user);
        setShowOrgPrompt(true);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking tenant:', error);
      setError('Failed to check organization status. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', { email, password, redirect: false });

      if (result?.ok && !result?.error) {
        const res = await fetch('/api/auth/session');
        const session = await res.json();

        if (email === 'super@littlewed.com') {
          window.location.href = '/admin/dashboard';
          return;
        }

        // Check if user has a tenant
        await checkUserTenant(session);
      } else {
        setError('Invalid email or password. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('A network error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await signIn('google', { redirect: false });
      
      if (result?.ok && !result?.error) {
        // Get session to check if user has tenant
        const res = await fetch('/api/auth/session');
        const session = await res.json();
        
        await checkUserTenant(session);
      } else {
        setError('Failed to sign in with Google. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('Failed to sign in with Google. Please try again.');
      setLoading(false);
    }
  };

  // ─── Create Organization for Google User ─────────────────────────────
  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('Please enter an organization name.');
      return;
    }

    setCreatingOrg(true);
    setError('');

    try {
      const res = await fetch('/api/auth/create-tenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationName: orgName.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Organization created successfully, redirect to dashboard
        toast.success('Organization created successfully!');
        window.location.href = '/client/dashboard';
      } else {
        setError(data.error || 'Failed to create organization. Please try again.');
        setCreatingOrg(false);
      }
    } catch {
      setError('Network error. Please try again.');
      setCreatingOrg(false);
    }
  };

  const Logo = ({ size = 'default' }: { size?: 'default' | 'mobile' }) => (
    <img
      src="/Little Wed Logo.svg"
      alt="Little Wed"
      style={{
        display: 'block',
        width: size === 'mobile' ? '100px' : '132px',
        height: 'auto',
      }}
    />
  );

  const navLinks = [
    { href: '/about', label: 'About', slug: 'about' },
    { href: '/pricing', label: 'Pricing', slug: 'pricing' },
  ];

  const features = [
    { icon: <MessageCircle size={14} />, label: 'WhatsApp & SMS invitations' },
    { icon: <ScanLine size={14} />, label: 'QR code check-in system' },
    { icon: <LayoutDashboard size={14} />, label: 'Real-time guest dashboard' },
    { icon: <FileHeart size={14} />, label: 'Custom invitation cards' },
  ];

  const slide = heroSlides[activeSlide];

  return (
    <div style={{ height: '100dvh', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          height: 100%;
          overflow: hidden;
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        .page {
          display: flex;
          height: 100dvh;
          overflow: hidden;
        }

        /* ── Left panel with hero carousel ── */
        .left {
          width: 42%;
          max-width: 520px;
          min-width: 400px;
          flex-shrink: 0;
          position: relative;
          overflow: hidden;
          animation: panelIn 0.7s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes panelIn {
          from { opacity: 0; transform: translateX(-24px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .left-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0;
          transition: opacity 1.1s ease;
        }

        .left-image.is-active { opacity: 1; }

        .left-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(
            to top,
            rgba(13, 79, 79, 0.94) 0%,
            rgba(13, 79, 79, 0.62) 42%,
            rgba(13, 79, 79, 0.22) 72%,
            rgba(13, 79, 79, 0.06) 100%
          );
        }

        .left-texture {
          position: absolute;
          inset: 0;
          z-index: 1;
          background:
            radial-gradient(ellipse at 20% 50%, rgba(232, 165, 152, 0.10) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 80%, rgba(232, 165, 152, 0.06) 0%, transparent 50%);
          pointer-events: none;
        }

        .left-hero-nav {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: clamp(20px, 4vh, 32px) clamp(28px, 4vw, 48px) 0;
          animation: fadeUp 0.7s 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }

        .hero-nav-links {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .hero-nav-link {
          color: rgba(255,255,255,0.82);
          text-decoration: none;
          font-size: 13px;
          font-weight: 600;
          transition: color 0.2s, filter 0.2s;
          border-radius: 6px;
        }

        .hero-nav-link:hover { filter: brightness(1.15); }

        .hero-nav-link.link-about { color: rgba(255,255,255,0.9); }
        .hero-nav-link.link-about:hover { color: #FF8A65; }

        .hero-nav-link.link-pricing { color: rgba(255,255,255,0.9); }
        .hero-nav-link.link-pricing:hover { color: #FF8A65; }

        .hero-nav-link.cta {
          background: rgba(255,255,255,0.95);
          color: #0D4F4F;
          padding: 8px 18px;
          border-radius: 20px;
          font-weight: 700;
          transition: background 0.2s, color 0.2s, transform 0.15s, box-shadow 0.15s;
        }

        .hero-nav-link.cta:hover {
          background: #E8A598;
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.25);
        }

        .left-content {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          height: 100%;
          padding: clamp(24px, 5vh, 40px) clamp(28px, 4vw, 48px) clamp(64px, 14vh, 120px);
        }

        .hero-text {
          position: relative;
          z-index: 2;
          animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(255,255,255,0.12);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.16);
          padding: 5px 14px 5px 11px;
          border-radius: 50px;
          color: rgba(255,255,255,0.9);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          margin-bottom: 16px;
        }

        .hero-badge svg { color: #E8A598; }

        .hero-title {
          font-family: 'Playfair Display', serif;
          font-size: clamp(26px, 3.4vh, 40px);
          font-weight: 900;
          color: white;
          line-height: 1.12;
          margin-bottom: 12px;
          letter-spacing: -0.5px;
        }

        .hero-title span {
          background: linear-gradient(135deg, #FFD1CF, #FC8C86);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hero-sub {
          color: rgba(255,255,255,0.88);
          font-size: 14px;
          line-height: 1.55;
          font-weight: 400;
          max-width: 320px;
          min-height: 44px;
        }

        .features {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-top: 20px;
          animation: fadeUp 0.6s 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }

        .feat {
          display: flex;
          align-items: center;
          gap: 12px;
          color: rgba(255,255,255,0.75);
          font-size: 12.5px;
          font-weight: 500;
        }

        .feat-dot {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          flex-shrink: 0;
          background: rgba(232,165,152,0.15);
          border: 1px solid rgba(232,165,152,0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #E8A598;
        }

        .hero-dots {
          display: flex;
          gap: 8px;
          margin-top: 22px;
        }

        .hero-dot {
          width: 22px;
          height: 4px;
          border-radius: 4px;
          background: rgba(255,255,255,0.3);
          border: none;
          padding: 0;
          cursor: pointer;
          transition: background 0.3s, width 0.3s;
        }

        .hero-dot:hover { background: rgba(255,255,255,0.5); }
        .hero-dot.active { background: #E8A598; width: 34px; }

        /* ── Right panel ── */
        .right {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: clamp(12px, 3vh, 28px) 32px;
          background: #F5F8FA;
          animation: fadeIn 0.6s 0.1s cubic-bezier(0.16,1,0.3,1) both;
          overflow-y: auto;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .right-inner {
          width: 100%;
          max-width: 430px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        /* ── Navigation ── */
        .nav {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 0 clamp(10px, 2vh, 18px);
          position: relative;
        }

        @media (min-width: 769px) {
          .nav--card { display: none; }
        }

        .nav-left { display: flex; align-items: center; flex-shrink: 0; }
        .nav-desktop { display: flex; gap: 24px; align-items: center; }

        .nav-link {
          color: #4A6072;
          text-decoration: none;
          font-size: 13.5px;
          font-weight: 600;
          transition: color 0.2s;
          position: relative;
          border-radius: 6px;
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

        .nav-link:hover { color: #0D4F4F; }
        .nav-link:hover::after { width: 100%; }

        .nav-link.cta {
          background: #0D4F4F;
          color: white;
          padding: 8px 20px;
          border-radius: 20px;
          font-weight: 600;
        }

        .nav-link.cta::after { display: none; }

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

        .mobile-menu-btn:hover { background: rgba(13,79,79,0.08); }

        .mobile-menu {
          display: none;
          flex-direction: column;
          gap: 4px;
          padding: 12px 0;
          width: 100%;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.1);
          margin-top: 8px;
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          z-index: 50;
        }

        .mobile-menu.open { display: flex; }
        .mobile-menu .nav-link { padding: 10px 16px; border-radius: 8px; }
        .mobile-menu .nav-link:hover { background: rgba(13,79,79,0.06); }
        .mobile-menu .nav-link.cta { margin: 4px 16px; }

        /* ── Card ── */
        .card {
          width: 100%;
          background: white;
          border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.07), 0 24px 48px rgba(0,0,0,0.05);
          animation: cardIn 0.65s 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(16px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .card-bar { height: 4px; background: linear-gradient(90deg, #0D4F4F, #E8A598); }

        /* ── Mobile hero ── */
        .mobile-hero {
          display: none;
          flex-direction: column;
          align-items: center;
          position: relative;
          overflow: hidden;
          text-align: center;
          min-height: 180px;
        }

        .mobile-hero-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0;
          transition: opacity 1.1s ease;
        }

        .mobile-hero-image.is-active { opacity: 1; }

        .mobile-hero-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(
            to bottom,
            rgba(13, 79, 79, 0.45) 0%,
            rgba(13, 79, 79, 0.82) 60%,
            rgba(13, 79, 79, 0.96) 100%
          );
        }

        .mobile-hero-content {
          position: relative;
          z-index: 2;
          padding: 24px 22px 20px;
          width: 100%;
        }

        .mobile-tagline {
          font-family: 'Playfair Display', serif;
          font-size: clamp(21px, 5.2vw, 25px);
          font-weight: 900;
          color: white;
          line-height: 1.18;
          margin-bottom: 6px;
        }

        .mobile-tagline span { color: #E8A598; }

        .mobile-sub {
          color: rgba(255,255,255,0.75);
          font-size: 12.5px;
          line-height: 1.45;
          margin-bottom: 12px;
          min-height: 34px;
        }

        .mobile-features {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          justify-content: center;
        }

        .mobile-feat-pill {
          display: flex;
          align-items: center;
          gap: 5px;
          background: rgba(255,255,255,0.1);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 20px;
          padding: 4px 10px;
          color: rgba(255,255,255,0.85);
          font-size: 11px;
          font-weight: 500;
        }

        .mobile-feat-pill svg { color: #E8A598; flex-shrink: 0; }

        .mobile-hero-dots {
          display: flex;
          gap: 6px;
          justify-content: center;
          margin-top: 12px;
        }

        .mobile-hero-dots .hero-dot { width: 16px; height: 3px; }
        .mobile-hero-dots .hero-dot.active { width: 24px; }

        /* ── Organization Prompt Modal ── */
        .org-prompt-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          padding: 20px;
          animation: fadeInOverlay 0.3s ease;
        }

        @keyframes fadeInOverlay {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .org-prompt-modal {
          background: white;
          border-radius: 24px;
          max-width: 480px;
          width: 100%;
          padding: 40px 36px;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.15);
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(30px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .org-prompt-icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: rgba(13, 79, 79, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0D4F4F;
          margin: 0 auto 16px;
        }

        .org-prompt-title {
          font-family: 'Playfair Display', serif;
          font-size: 24px;
          font-weight: 800;
          color: #0D1B1B;
          text-align: center;
          margin-bottom: 8px;
        }

        .org-prompt-sub {
          text-align: center;
          color: #7A8FA6;
          font-size: 14px;
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .org-prompt-input {
          width: 100%;
          padding: 14px 16px;
          border: 1.5px solid #E2EAF0;
          border-radius: 13px;
          font-size: 15px;
          font-family: inherit;
          outline: none;
          color: #0D1B1B;
          background: white;
          font-weight: 500;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .org-prompt-input:focus {
          border-color: #0D4F4F;
          box-shadow: 0 0 0 4px rgba(13, 79, 79, 0.08);
        }

        .org-prompt-input::placeholder {
          color: #9BAAB8;
        }

        .org-prompt-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .org-prompt-btn {
          flex: 1;
          padding: 14px;
          border: none;
          border-radius: 13px;
          font-size: 14px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }

        .org-prompt-btn.primary {
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white;
          box-shadow: 0 4px 16px rgba(13, 79, 79, 0.3);
        }

        .org-prompt-btn.primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(13, 79, 79, 0.4);
        }

        .org-prompt-btn.primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .org-prompt-btn.secondary {
          background: transparent;
          color: #7A8FA6;
          border: 1.5px solid #E2EAF0;
        }

        .org-prompt-btn.secondary:hover {
          background: #F5F8FA;
          border-color: #C8D4DE;
        }

        .org-prompt-error {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          color: #C0392B;
          padding: 10px 14px;
          border-radius: 11px;
          font-size: 13px;
          font-weight: 600;
          margin-top: 12px;
          display: flex;
          gap: 8px;
          align-items: center;
        }

        /* Form body */
        .form-body { padding: clamp(18px, 3vh, 28px) 28px clamp(16px, 2.5vh, 22px); }

        .eyebrow {
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: #0D4F4F;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .form-title {
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 800;
          color: #0D1B1B;
          margin-bottom: 4px;
          letter-spacing: -0.3px;
        }

        .form-sub {
          font-size: 12.5px;
          color: #7A8FA6;
          margin-bottom: clamp(14px, 2.5vh, 20px);
          line-height: 1.5;
        }

        .field { position: relative; margin-bottom: 13px; }
        .flabel {
          position: absolute;
          left: 15px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 14px;
          color: #9BAAB8;
          pointer-events: none;
          background: white;
          padding: 0 4px;
          font-weight: 500;
          transition: top 0.2s cubic-bezier(0.4,0,0.2,1),
                      font-size 0.2s cubic-bezier(0.4,0,0.2,1),
                      color 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        .flabel.up { top: 0; font-size: 10.5px; color: #0D4F4F; font-weight: 700; letter-spacing: 0.3px; }

        .finput {
          width: 100%;
          padding: 13px 15px;
          border: 1.5px solid #E2EAF0;
          border-radius: 13px;
          font-size: 16px;
          font-family: inherit;
          outline: none;
          color: #0D1B1B;
          background: white;
          font-weight: 500;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .finput:focus { border-color: #0D4F4F; box-shadow: 0 0 0 4px rgba(13,79,79,0.08); }
        .finput.err { border-color: #E05C5C; box-shadow: 0 0 0 4px rgba(224,92,92,0.08); }
        .finput:disabled { background: #F7F9FB; cursor: not-allowed; }

        .eye-btn {
          position: absolute;
          right: 13px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: #9BAAB8;
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 6px;
          transition: color 0.15s;
        }
        .eye-btn:hover { color: #0D4F4F; }

        .forgot {
          display: block;
          text-align: right;
          margin-top: -6px;
          margin-bottom: 14px;
          font-size: 12px;
          font-weight: 600;
          color: #0D4F4F;
          text-decoration: none;
          transition: opacity 0.15s;
        }
        .forgot:hover { opacity: 0.65; }

        .err-box {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          color: #C0392B;
          padding: 9px 13px;
          border-radius: 11px;
          font-size: 12.5px;
          font-weight: 600;
          margin-bottom: 13px;
          display: flex;
          gap: 8px;
          align-items: flex-start;
          animation: shake 0.35s ease;
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          80% { transform: translateX(-3px); }
        }

        .btn {
          width: 100%;
          padding: 14px;
          border: none;
          border-radius: 13px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white;
          font-size: 14.5px;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 16px rgba(13,79,79,0.35);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
          letter-spacing: 0.2px;
          position: relative;
          overflow: hidden;
        }
        .btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
          opacity: 0;
          transition: opacity 0.2s;
        }
        .btn:hover:not(:disabled)::after { opacity: 1; }
        .btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(13,79,79,0.4); }
        .btn:active:not(:disabled) { transform: translateY(0); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 14px 0 0;
          color: #C8D4DE;
          font-size: 11px;
          font-weight: 600;
        }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #EEF2F6; }

        .btn-google {
          width: 100%;
          padding: 12px;
          border: 1.5px solid #E2EAF0;
          border-radius: 13px;
          background: white;
          color: #4A6072;
          font-size: 13.5px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
          margin-top: 8px;
        }
        .btn-google:hover { border-color: #0D4F4F; background: #F5FAF9; box-shadow: 0 2px 8px rgba(13,79,79,0.08); }
        .btn-google:disabled { opacity: 0.6; cursor: not-allowed; }

        .card-footer {
          text-align: center;
          font-size: 12.5px;
          color: #7A8FA6;
          padding: 12px 28px 16px;
        }
        .card-footer a { color: #0D4F4F; font-weight: 700; text-decoration: none; }
        .card-footer a:hover { text-decoration: underline; }

        .page-footer {
          width: 100%;
          margin-top: clamp(10px, 2vh, 20px);
          padding: 10px 0 4px;
          border-top: 1px solid #E8EEF2;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-items: center;
          gap: 16px;
        }

        .footer-brand {
          display: flex;
          align-items: center;
          gap: 6px;
          color: #7A8FA6;
          font-size: 11.5px;
          font-weight: 500;
        }

        .footer-brand strong { color: #0D4F4F; font-weight: 700; }
        .footer-heart { color: #E8A598; }

        .footer-links { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }

        .footer-link {
          color: #9BAAB8;
          text-decoration: none;
          font-size: 11.5px;
          font-weight: 500;
          transition: color 0.2s;
        }
        .footer-link:hover { color: #0D4F4F; }
        .footer-sep { color: #DCE4EA; font-weight: 300; }

        .float-element {
          position: absolute;
          border-radius: 50%;
          background: rgba(255,255,255,0.04);
          pointer-events: none;
          animation: float 14s ease-in-out infinite;
          z-index: 1;
        }

        .float-element:nth-child(2) { width: 110px; height: 110px; top: 12%; right: 10%; animation-delay: 0s; }
        .float-element:nth-child(3) { width: 70px; height: 70px; bottom: 30%; left: 8%; animation-delay: 4s; }
        .float-element:nth-child(4) { width: 50px; height: 50px; top: 55%; right: 20%; animation-delay: 8s; }

        @keyframes float {
          0%,100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(10px, -15px) scale(1.05); }
          66% { transform: translate(-8px, 10px) scale(0.95); }
        }

        @media (max-width: 1024px) {
          .left { width: 38%; min-width: 300px; }
        }

        @media (max-width: 768px) {
          html, body { overflow: auto; }
          .page { height: auto; min-height: 100dvh; overflow: visible; }

          .left { display: none; }

          .right {
            height: auto;
            min-height: 100dvh;
            padding: 0 16px calc(20px + env(safe-area-inset-bottom));
            background: #F5F8FA;
            justify-content: flex-start;
            overflow: visible;
          }

          .right-inner { max-width: 100%; }

          .card {
            border-radius: 0 0 24px 24px;
            animation: cardInMobile 0.65s 0.1s cubic-bezier(0.16,1,0.3,1) both;
            overflow: hidden;
          }

          @keyframes cardInMobile {
            from { opacity: 0; transform: translateY(-16px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          .mobile-hero { display: flex; min-height: 200px; }
          .card-bar { display: none; }

          .form-body { padding: 22px 20px 18px; }
          .form-title { font-size: 19px; }
          .card-footer { padding: 10px 20px 16px; }

          .nav--card {
            position: sticky;
            top: 0;
            z-index: 40;
            background: rgba(245, 248, 250, 0.92);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            box-shadow: 0 2px 14px rgba(13, 79, 79, 0.08);
            margin: 0 -16px;
            padding: calc(10px + env(safe-area-inset-top)) 16px 12px;
          }

          .nav-desktop { display: none; }

          .mobile-menu-btn { display: flex; align-items: center; justify-content: center; }

          .mobile-menu {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            padding: 8px 0;
            z-index: 50;
          }
          .mobile-menu.open { display: flex; }

          .page-footer { flex-direction: column; text-align: center; padding: 16px 0 8px; gap: 10px; }
          .footer-links { justify-content: center; }

          .org-prompt-modal {
            padding: 32px 24px;
            margin: 16px;
          }

          .org-prompt-title {
            font-size: 20px;
          }

          .org-prompt-actions {
            flex-direction: column;
          }
        }

        @media (max-width: 380px) {
          .form-body { padding: 18px 16px 16px; }
          .mobile-hero { min-height: 170px; }
          .mobile-hero-content { padding: 20px 16px 16px; }
        }

        @media (min-width: 769px) {
          .mobile-menu-btn { display: none; }
          .mobile-menu { display: none !important; }
        }
      `}</style>

      <div className="page">
        {/* ── Desktop left panel ── */}
        <div className="left">
          {heroSlides.map((s, i) => (
            <img
              key={s.image + i}
              src={s.image}
              alt=""
              className={`left-image ${i === activeSlide ? 'is-active' : ''}`}
              fetchPriority={i === 0 ? 'high' : undefined}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          ))}

          <div className="left-overlay"></div>
          <div className="left-texture"></div>

          <div className="float-element"></div>
          <div className="float-element"></div>
          <div className="float-element"></div>

          <div className="left-hero-nav">
            <Logo />
            <div className="hero-nav-links">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className={`hero-nav-link link-${link.slug}`}>
                  {link.label}
                </Link>
              ))}
              <Link href="/signup" className="hero-nav-link cta">
                Get Started
              </Link>
            </div>
          </div>

          <div className="left-content">
            <div className="hero-text" key={activeSlide}>
              <div className="hero-badge">
                <Heart size={12} fill="currentColor" />
                {slide.badge}
              </div>
              <h1 className="hero-title">
                {slide.titleLine1}<br /><span>{slide.titleHighlight}</span>
              </h1>
              <p className="hero-sub">{slide.sub}</p>
            </div>

            <div className="features">
              {features.map(({ icon, label }) => (
                <div className="feat" key={label}>
                  <div className="feat-dot">{icon}</div>
                  <span>{label}</span>
                </div>
              ))}
            </div>

            <div className="hero-dots">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  className={`hero-dot ${i === activeSlide ? 'active' : ''}`}
                  onClick={() => setActiveSlide(i)}
                  aria-label={`Show slide ${i + 1} of ${heroSlides.length}`}
                  aria-current={i === activeSlide}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="right">
          <div className="right-inner">
            {/* ── Navigation ── */}
            <div className="nav nav--card">
              <div className="nav-left">
                <Logo />
              </div>

              <div className="nav-desktop">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href} className={`nav-link link-${link.slug}`}>
                    {link.label}
                  </Link>
                ))}
                <Link href="/signup" className="nav-link cta">
                  Get Started
                </Link>
              </div>

              <button
                className="mobile-menu-btn"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileMenuOpen}
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>

              <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`nav-link link-${link.slug}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {link.label}
                  </Link>
                ))}
                <Link
                  href="/signup"
                  className="nav-link cta"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get Started
                </Link>
              </div>
            </div>

            <div className="card">
              {/* ── Mobile hero ── */}
              <div className="mobile-hero">
                {heroSlides.map((s, i) => (
                  <img
                    key={s.image + i}
                    src={s.image}
                    alt=""
                    className={`mobile-hero-image ${i === activeSlide ? 'is-active' : ''}`}
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                ))}
                <div className="mobile-hero-overlay"></div>
                <div className="mobile-hero-content">
                  <div className="mobile-tagline">
                    {slide.titleLine1}<br /><span>{slide.titleHighlight}</span>
                  </div>
                  <p className="mobile-sub">{slide.mobileSub}</p>
                  <div className="mobile-features">
                    {features.slice(0, 2).map(({ icon, label }) => (
                      <div className="mobile-feat-pill" key={label}>
                        {icon}<span>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mobile-hero-dots">
                    {heroSlides.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`hero-dot ${i === activeSlide ? 'active' : ''}`}
                        onClick={() => setActiveSlide(i)}
                        aria-label={`Show slide ${i + 1} of ${heroSlides.length}`}
                        aria-current={i === activeSlide}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="card-bar" />

              <div className="form-body">
                <div className="eyebrow">Welcome back</div>
                <div className="form-title">Sign in to your account</div>
                <p className="form-sub">Enter your credentials to access your dashboard.</p>

                {error && (
                  <div className="err-box" role="alert" aria-live="assertive">
                    <span aria-hidden="true">⚠️</span><span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <div className="field">
                    <label className={`flabel ${emailFocused || email ? 'up' : ''}`} htmlFor="email">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      className={`finput${error ? ' err' : ''}`}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      autoComplete="email"
                      disabled={loading}
                      aria-invalid={!!error}
                    />
                  </div>

                  <div className="field">
                    <label className={`flabel ${passwordFocused || password ? 'up' : ''}`} htmlFor="password">
                      Password
                    </label>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      className={`finput${error ? ' err' : ''}`}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      autoComplete="current-password"
                      disabled={loading}
                      aria-invalid={!!error}
                      style={{ paddingRight: 46 }}
                    />
                    <button
                      type="button"
                      className="eye-btn"
                      onClick={() => setShowPassword(s => !s)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  <Link href="/forgot-password" className="forgot">
                    Forgot password?
                  </Link>

                  <button type="submit" className="btn" disabled={loading}>
                    {loading
                      ? <><div className="spinner" /> Signing in…</>
                      : <>Sign In <ArrowRight size={16} /></>
                    }
                  </button>
                </form>

                <div className="divider">or</div>

                <button
                  onClick={handleGoogleSignIn}
                  className="btn-google"
                  type="button"
                  disabled={loading}
                >
                  <svg viewBox="0 0 24 24" style={{ width: 18, height: 18 }} aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Continue with Google
                </button>
              </div>

              <div className="card-footer">
                Don&apos;t have an account? <a href="/signup">Create one</a>
              </div>
            </div>

            {/* ── Footer ── */}
            <div className="page-footer">
              <div className="footer-brand">
                <span>© 2026</span>
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
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Organization Prompt Modal ── */}
      {showOrgPrompt && (
        <div className="org-prompt-overlay">
          <div className="org-prompt-modal">
            <div className="org-prompt-icon">
              <Building size={32} />
            </div>
            <h2 className="org-prompt-title">Create Your Organization</h2>
            <p className="org-prompt-sub">
              You're signed in as <strong>{googleUser?.name || googleUser?.email}</strong>.<br />
              To get started, create an organization for your events.
            </p>

            <form onSubmit={handleCreateOrganization}>
              <div className="field">
                <label className={`flabel ${orgName ? 'up' : ''}`} htmlFor="orgName">
                  Organization Name
                </label>
                <input
                  id="orgName"
                  type="text"
                  className={`org-prompt-input ${error ? 'err' : ''}`}
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  onFocus={() => setEmailFocused(true)}
                  onBlur={() => setEmailFocused(false)}
                  placeholder="e.g., ABC Events"
                  disabled={creatingOrg}
                  autoFocus
                />
              </div>

              {error && (
                <div className="org-prompt-error">
                  <AlertCircle size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="org-prompt-actions">
                <button
                  type="button"
                  className="org-prompt-btn secondary"
                  onClick={() => {
                    setShowOrgPrompt(false);
                    window.location.href = '/';
                  }}
                  disabled={creatingOrg}
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  className="org-prompt-btn primary"
                  disabled={creatingOrg || !orgName.trim()}
                >
                  {creatingOrg ? (
                    <>
                      <div className="spinner" />
                      Creating...
                    </>
                  ) : (
                    'Create Organization'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}