'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Mail, CheckCircle, Globe, Building } from 'lucide-react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    if (!email || !password) { setError('Please enter both email and password.'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', { email, password, redirect: false });
      console.log('signIn result:', result);
      if (result?.ok && !result?.error) {

        // Fetch session to get role
        const res = await fetch('/api/auth/session');
        const session = await res.json();

        // Temporary hard redirect for super admin (remove after)
        if (email === 'super@littlewed.com') {
          window.location.href = '/admin/dashboard';
          return;
        }

        const role = session?.user?.role;
        if (role === 'SUPER_ADMIN') {
          window.location.href = '/admin/dashboard';
        } else if (role === 'STAFF') {
          window.location.href = '/client/staff/dashboard';
        } else {
          window.location.href = '/client/dashboard';
        }
      } else {
        setError('Invalid email or password. Please try again.');
        setLoading(false);
      }
    } catch {
      setError('A network error occurred. Please try again.');
      setLoading(false);
    }
  };

  const Logo = () => (
    <img
      src="/Little Wed Logo.svg"
      alt="Little Wed"
      style={{ display: 'block', width: '180px', height: 'auto' }}
    />
  );

  const features = [
    { icon: <Mail size={13} />, label: 'WhatsApp & SMS invitations' },
    { icon: <CheckCircle size={13} />, label: 'QR code check-in system' },
    { icon: <Globe size={13} />, label: 'Real-time guest dashboard' },
    { icon: <Building size={13} />, label: 'Custom invitation cards' },
  ];

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Page layout ── */
        .page {
          display: flex;
          min-height: 100vh;
        }

        /* ── Left panel (desktop) ── */
        .left {
          width: 420px;
          flex-shrink: 0;
          background: linear-gradient(160deg, #0D4F4F 0%, #0A3D3D 55%, #082E2E 100%);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 40px;
          position: relative;
          overflow: hidden;
          animation: panelIn 0.7s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes panelIn {
          from { opacity: 0; transform: translateX(-32px); }
          to   { opacity: 1; transform: translateX(0); }
        }

        .left::before {
          content: ''; position: absolute; top: -100px; right: -100px;
          width: 340px; height: 340px; border-radius: 50%;
          background: rgba(255,255,255,0.04);
          animation: floatA 8s ease-in-out infinite;
        }
        .left::after {
          content: ''; position: absolute; bottom: -80px; left: -80px;
          width: 280px; height: 280px; border-radius: 50%;
          background: rgba(232,165,152,0.07);
          animation: floatB 10s ease-in-out infinite;
        }

        @keyframes floatA {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(20px,-20px) scale(1.05); }
        }
        @keyframes floatB {
          0%,100% { transform: translate(0,0) scale(1); }
          50%      { transform: translate(-15px,15px) scale(1.08); }
        }

        .left-logo {
          position: relative; z-index: 2;
          animation: fadeDown 0.6s 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }

        .left-copy {
          position: relative; z-index: 2;
          animation: fadeDown 0.6s 0.35s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .tagline {
          font-family: 'Playfair Display', serif;
          font-size: 38px; font-weight: 900;
          color: white; line-height: 1.15;
          margin-bottom: 14px; letter-spacing: -0.5px;
        }
        .tagline span { color: #E8A598; }

        .tagline-sub {
          color: rgba(255,255,255,0.5);
          font-size: 14px; line-height: 1.65; font-weight: 400;
        }

        .features {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; gap: 11px;
          animation: fadeUp 0.6s 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .feat {
          display: flex; align-items: center; gap: 11px;
          color: rgba(255,255,255,0.72); font-size: 13.5px; font-weight: 500;
        }
        .feat-dot {
          width: 27px; height: 27px; border-radius: 8px; flex-shrink: 0;
          background: rgba(232,165,152,0.18); border: 1px solid rgba(232,165,152,0.28);
          display: flex; align-items: center; justify-content: center; color: #E8A598;
        }

        /* ── Right panel ── */
        .right {
          flex: 1;
          display: flex; align-items: center; justify-content: center;
          padding: 40px 24px;
          background: #F0F4F8;
          animation: fadeIn 0.6s 0.1s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .right-inner { width: 100%; max-width: 460px; }

        /* ── Card ── */
        .card {
          background: white; border-radius: 24px; overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.07), 0 24px 48px rgba(0,0,0,0.05);
          animation: cardIn 0.65s 0.25s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .card-bar { height: 4px; background: linear-gradient(90deg, #0D4F4F, #E8A598); }

        /* Mobile hero — hidden on desktop */
        .mobile-hero {
          display: none;
          flex-direction: column;
          align-items: center;
          padding: 36px 32px 28px;
          background: linear-gradient(160deg, #0D4F4F 0%, #0A3D3D 100%);
          position: relative;
          overflow: hidden;
          text-align: center;
        }

        .mobile-hero::before {
          content: ''; position: absolute; top: -60px; right: -60px;
          width: 200px; height: 200px; border-radius: 50%;
          background: rgba(255,255,255,0.04);
          animation: floatA 8s ease-in-out infinite;
        }

        .mobile-logo {
          position: relative; z-index: 1; margin-bottom: 20px;
        }

        .mobile-tagline {
          position: relative; z-index: 1;
          font-family: 'Playfair Display', serif;
          font-size: 24px; font-weight: 900; color: white;
          line-height: 1.2; margin-bottom: 8px;
        }
        .mobile-tagline span { color: #E8A598; }

        .mobile-sub {
          position: relative; z-index: 1;
          color: rgba(255,255,255,0.55); font-size: 13px; line-height: 1.6;
          margin-bottom: 20px;
        }

        .mobile-features {
          position: relative; z-index: 1;
          display: flex; flex-wrap: wrap; gap: 8px; justify-content: center;
        }

        .mobile-feat-pill {
          display: flex; align-items: center; gap: 6px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px; padding: 5px 12px;
          color: rgba(255,255,255,0.8); font-size: 12px; font-weight: 500;
        }
        .mobile-feat-pill svg { color: #E8A598; flex-shrink: 0; }

        /* Form body */
        .form-body { padding: 36px 36px 32px; }

        .eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          color: #0D4F4F; text-transform: uppercase; margin-bottom: 6px;
        }
        .form-title {
          font-family: 'Playfair Display', serif; font-size: 24px;
          font-weight: 800; color: #0D1B1B; margin-bottom: 4px; letter-spacing: -0.3px;
        }
        .form-sub { font-size: 13.5px; color: #7A8FA6; margin-bottom: 28px; line-height: 1.5; }

        /* Fields */
        .field { position: relative; margin-bottom: 18px; }
        .flabel {
          position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
          font-size: 14px; color: #9BAAB8; pointer-events: none; background: white;
          padding: 0 4px; font-weight: 500;
          transition: top 0.2s cubic-bezier(0.4,0,0.2,1),
                      font-size 0.2s cubic-bezier(0.4,0,0.2,1),
                      color 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        .flabel.up { top: 0; font-size: 10.5px; color: #0D4F4F; font-weight: 700; letter-spacing: 0.3px; }

        .finput {
          width: 100%; padding: 15px; border: 1.5px solid #E2EAF0; border-radius: 13px;
          font-size: 14px; font-family: inherit; outline: none; color: #0D1B1B;
          background: white; font-weight: 500;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .finput:focus { border-color: #0D4F4F; box-shadow: 0 0 0 4px rgba(13,79,79,0.08); }
        .finput.err   { border-color: #E05C5C; box-shadow: 0 0 0 4px rgba(224,92,92,0.08); }

        .eye-btn {
          position: absolute; right: 13px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #9BAAB8;
          display: flex; align-items: center; padding: 4px; transition: color 0.15s;
        }
        .eye-btn:hover { color: #0D4F4F; }

        .forgot {
          display: block; text-align: right; margin-top: -10px; margin-bottom: 22px;
          font-size: 12.5px; font-weight: 700; color: #0D4F4F; text-decoration: none;
          transition: opacity 0.15s;
        }
        .forgot:hover { opacity: 0.65; }

        /* Error */
        .err-box {
          background: #FEF2F2; border: 1px solid #FECACA; color: #C0392B;
          padding: 11px 14px; border-radius: 11px; font-size: 13px; font-weight: 600;
          margin-bottom: 18px; display: flex; gap: 8px; align-items: flex-start;
          animation: shake 0.35s ease;
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          60%      { transform: translateX(6px); }
          80%      { transform: translateX(-3px); }
        }

        /* Button */
        .btn {
          width: 100%; padding: 15px; border: none; border-radius: 13px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 15px; font-weight: 700; font-family: inherit;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 16px rgba(13,79,79,0.35);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
          letter-spacing: 0.2px; position: relative; overflow: hidden;
        }
        .btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
          opacity: 0; transition: opacity 0.2s;
        }
        .btn:hover:not(:disabled)::after { opacity: 1; }
        .btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(13,79,79,0.4); }
        .btn:active:not(:disabled) { transform: translateY(0); }
        .btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .spinner {
          width: 17px; height: 17px;
          border: 2px solid rgba(255,255,255,0.3); border-top-color: white;
          border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Divider */
        .divider {
          display: flex; align-items: center; gap: 10px;
          margin: 20px 0 0; color: #C8D4DE; font-size: 11.5px; font-weight: 600;
        }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: #EEF2F6; }

        /* Footer */
        .card-footer {
          text-align: center; font-size: 13px; color: #7A8FA6;
          padding: 16px 36px 28px;
        }
        .card-footer a { color: #0D4F4F; font-weight: 700; text-decoration: none; }
        .card-footer a:hover { text-decoration: underline; }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .left { display: none; }

          .right {
            padding: 0;
            background: #F0F4F8;
            align-items: flex-start;
          }

          .right-inner { max-width: 100%; }

          .card {
            border-radius: 0 0 28px 28px;
            animation: cardInMobile 0.65s 0.1s cubic-bezier(0.16,1,0.3,1) both;
          }

          @keyframes cardInMobile {
            from { opacity: 0; transform: translateY(-20px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          /* Show mobile hero */
          .mobile-hero { display: flex; }

          .card-bar { display: none; }

          .form-body { padding: 28px 24px 24px; }
          .form-title { font-size: 22px; }
          .card-footer { padding: 12px 24px 24px; }

          /* Bottom content on mobile */
          .mobile-bottom {
            padding: 24px 20px 32px;
            display: flex; flex-direction: column; gap: 10px;
          }

          .mobile-bottom-feat {
            display: flex; align-items: center; gap: 10px;
            color: #4A6072; font-size: 13px; font-weight: 500;
          }

          .mobile-bottom-dot {
            width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
            background: rgba(13,79,79,0.08); border: 1px solid rgba(13,79,79,0.12);
            display: flex; align-items: center; justify-content: center; color: #0D4F4F;
          }
        }

        @media (min-width: 769px) {
          .mobile-bottom { display: none; }
        }
      `}</style>

      <div className="page">
        {/* ── Desktop left panel ── */}
        <div className="left">
          <div className="left-logo">
            <Logo />
          </div>

          <div className="left-copy">
            <div className="tagline">
              Welcome<br /><span>back.</span>
            </div>
            <p className="tagline-sub">
              Sign in to manage your events, guests, and invitations — all in one place.
            </p>
          </div>

          <div className="features">
            {features.map(({ icon, label }) => (
              <div className="feat" key={label}>
                <div className="feat-dot">{icon}</div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="right">
          <div className="right-inner">
            <div className="card">

              {/* Mobile hero — visible only on mobile */}
              <div className="mobile-hero">
                <div className="mobile-logo"><Logo /></div>
                <div className="mobile-tagline">
                  Welcome <span>back.</span>
                </div>
                <p className="mobile-sub">
                  Sign in to manage your events, guests, and invitations.
                </p>
                <div className="mobile-features">
                  {features.map(({ icon, label }) => (
                    <div className="mobile-feat-pill" key={label}>
                      {icon}<span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Desktop top bar */}
              <div className="card-bar" />

              <div className="form-body">
                <div className="eyebrow">Welcome back</div>
                <div className="form-title">Sign in to your account</div>
                <p className="form-sub">Enter your credentials to access your dashboard.</p>

                {error && (
                  <div className="err-box">
                    <span>⚠️</span><span>{error}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} onKeyDown={e => { if (e.key === 'Enter') handleSubmit(e); }} noValidate>
                  <div className="field">
                    <label className={`flabel ${emailFocused || email ? 'up' : ''}`} htmlFor="email">
                      Email address
                    </label>
                    <input
                      id="email" type="email"
                      className={`finput${error ? ' err' : ''}`}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      autoComplete="email"
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
                      style={{ paddingRight: 46 }}
                    />
                    <button type="button" className="eye-btn" onClick={() => setShowPassword(s => !s)} tabIndex={-1}>
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>

                  <Link href="/forgot-password" className="text-sm text-[#0D4F4F] hover:underline mt-2 block text-right">
                    Forgot password?
                  </Link>

                  <button type="button" className="btn" disabled={loading} onClick={handleSubmit}>
                    {loading
                      ? <><div className="spinner" /> Signing in…</>
                      : <>Sign In <ArrowRight size={16} /></>
                    }
                  </button>
                </form>

                <div className="divider">or</div>
              </div>

              <div className="card-footer">
                Don't have an account? <a href="/signup">Create one</a>
              </div>
            </div>

            {/* Mobile bottom features (below card) */}
            <div className="mobile-bottom">
              {features.map(({ icon, label }) => (
                <div className="mobile-bottom-feat" key={label}>
                  <div className="mobile-bottom-dot">{icon}</div>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}