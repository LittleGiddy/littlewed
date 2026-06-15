'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, CheckCircle, Shield, KeyRound } from 'lucide-react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSendOtp = async () => {
    if (!email) {
      setError('Email required');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('OTP sent to your email');
      setStep(2);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (!otp || otp.length !== 6) {
      setError('Please enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess('Password reset successful! Redirecting to login...');
      setTimeout(() => router.push('/login'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
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

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }

        .page { display: flex; min-height: 100vh; }

        .left {
          width: 420px; flex-shrink: 0;
          background: linear-gradient(160deg, #0D4F4F 0%, #0A3D3D 55%, #082E2E 100%);
          display: flex; flex-direction: column; justify-content: space-between;
          padding: 48px 40px; position: relative; overflow: hidden;
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
          50% { transform: translate(20px,-20px) scale(1.05); }
        }
        @keyframes floatB {
          0%,100% { transform: translate(0,0) scale(1); }
          50% { transform: translate(-15px,15px) scale(1.08); }
        }
        .left-logo { position: relative; z-index: 2; animation: fadeDown 0.6s 0.2s cubic-bezier(0.16,1,0.3,1) both; }
        .left-copy { position: relative; z-index: 2; animation: fadeDown 0.6s 0.35s cubic-bezier(0.16,1,0.3,1) both; }
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tagline {
          font-family: 'Playfair Display', serif;
          font-size: 36px; font-weight: 900; color: white;
          line-height: 1.15; margin-bottom: 14px; letter-spacing: -0.5px;
        }
        .tagline span { color: #E8A598; }
        .tagline-sub { color: rgba(255,255,255,0.5); font-size: 14px; line-height: 1.65; }

        .features-left {
          position: relative; z-index: 2;
          display: flex; flex-direction: column; gap: 11px;
          animation: fadeUp 0.6s 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .feat { display: flex; align-items: center; gap: 11px; color: rgba(255,255,255,0.72); font-size: 13.5px; font-weight: 500; }
        .feat-dot {
          width: 27px; height: 27px; border-radius: 8px; flex-shrink: 0;
          background: rgba(232,165,152,0.18); border: 1px solid rgba(232,165,152,0.28);
          display: flex; align-items: center; justify-content: center; color: #E8A598;
        }

        .right {
          flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 40px 24px; background: #F0F4F8;
          animation: fadeIn 0.6s 0.1s both;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .right-inner { width: 100%; max-width: 460px; }

        .card {
          background: white; border-radius: 24px; overflow: hidden;
          box-shadow: 0 2px 4px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.07), 0 24px 48px rgba(0,0,0,0.05);
          animation: cardIn 0.65s 0.25s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Mobile hero */
        .mobile-hero {
          display: none;
          flex-direction: column;
          align-items: center;
          padding: 40px 28px 32px;
          background: linear-gradient(160deg, #0D4F4F 0%, #0A3D3D 100%);
          position: relative; overflow: hidden; text-align: center;
        }
        .mobile-hero::before {
          content: ''; position: absolute; top: -60px; right: -60px;
          width: 220px; height: 220px; border-radius: 50%;
          background: rgba(255,255,255,0.04);
          animation: floatA 8s ease-in-out infinite;
        }
        .mobile-hero::after {
          content: ''; position: absolute; bottom: -40px; left: -40px;
          width: 160px; height: 160px; border-radius: 50%;
          background: rgba(232,165,152,0.07);
          animation: floatB 10s ease-in-out infinite;
        }
        .mobile-logo-wrap { position: relative; z-index: 2; margin-bottom: 20px; animation: fadeDown 0.6s 0.1s cubic-bezier(0.16,1,0.3,1) both; }
        .mobile-tagline {
          position: relative; z-index: 2;
          font-family: 'Playfair Display', serif;
          font-size: 24px; font-weight: 900; color: white;
          line-height: 1.2; margin-bottom: 10px;
          animation: fadeDown 0.6s 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }
        .mobile-tagline span { color: #E8A598; }
        .mobile-sub {
          position: relative; z-index: 2;
          color: rgba(255,255,255,0.55); font-size: 13px; line-height: 1.6;
          margin-bottom: 22px; max-width: 300px;
          animation: fadeDown 0.6s 0.3s cubic-bezier(0.16,1,0.3,1) both;
        }
        .mobile-pills {
          position: relative; z-index: 2;
          display: flex; flex-wrap: wrap; gap: 7px; justify-content: center;
          animation: fadeUp 0.6s 0.4s cubic-bezier(0.16,1,0.3,1) both;
        }
        .pill {
          display: flex; align-items: center; gap: 5px;
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.15);
          border-radius: 20px; padding: 5px 12px;
          color: rgba(255,255,255,0.82); font-size: 11.5px; font-weight: 500;
        }
        .pill svg { color: #E8A598; flex-shrink: 0; }

        .form-body { padding: 36px 36px 32px; }
        .form-title {
          font-family: 'Playfair Display', serif; font-size: 28px;
          font-weight: 800; color: #0D1B1B; margin-bottom: 8px; letter-spacing: -0.3px;
        }
        .form-subtitle { font-size: 13.5px; color: #7A8FA6; margin-bottom: 28px; line-height: 1.5; }

        .field-wrap { position: relative; margin-bottom: 18px; }
        .field-label {
          position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
          font-size: 14px; color: #9BAAB8; pointer-events: none; background: white;
          padding: 0 4px; font-weight: 500;
          transition: top 0.2s cubic-bezier(0.4,0,0.2,1), font-size 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        .field-label.up { top: 0; font-size: 10.5px; color: #0D4F4F; font-weight: 700; letter-spacing: 0.3px; }
        .field-input {
          width: 100%; padding: 15px; border: 1.5px solid #E2EAF0; border-radius: 13px;
          font-size: 14px; font-family: inherit; outline: none; color: #0D1B1B;
          background: white; font-weight: 500;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .field-input:focus { border-color: #0D4F4F; box-shadow: 0 0 0 4px rgba(13,79,79,0.08); }

        .btn-primary {
          width: 100%; padding: 15px; border: none; border-radius: 13px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 15px; font-weight: 700; font-family: inherit;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 16px rgba(13,79,79,0.35);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
        }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(13,79,79,0.4); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-secondary {
          width: 100%; padding: 14px; border: 1.5px solid #E2EAF0; border-radius: 13px;
          background: white; color: #4A6072; font-size: 14px; font-weight: 600;
          font-family: inherit; cursor: pointer; margin-top: 10px;
          transition: border-color 0.15s, background 0.15s, color 0.15s;
        }
        .btn-secondary:hover { border-color: #0D4F4F; color: #0D4F4F; background: #F5FAF9; }

        .spinner {
          width: 17px; height: 17px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .err-box {
          background: #FEF2F2; border: 1px solid #FECACA; color: #C0392B;
          padding: 11px 14px; border-radius: 11px; font-size: 13px; font-weight: 600;
          margin-bottom: 18px; display: flex; gap: 8px; align-items: flex-start;
          animation: shake 0.35s ease;
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
        }
        .success-box {
          background: #E8F5E9; border: 1px solid #A5D6A7; color: #2E7D32;
          padding: 11px 14px; border-radius: 11px; font-size: 13px; font-weight: 600;
          margin-bottom: 18px; display: flex; gap: 8px; align-items: center;
        }

        .footer-link { text-align: center; font-size: 13px; color: #7A8FA6; padding: 16px 36px 28px; }
        .footer-link a { color: #0D4F4F; font-weight: 700; text-decoration: none; }

        @media (max-width: 768px) {
          .left { display: none; }
          .right { padding: 0; background: #F0F4F8; align-items: flex-start; }
          .right-inner { max-width: 100%; }
          .card { border-radius: 0 0 28px 28px; }
          .mobile-hero { display: flex; }
          .form-body { padding: 26px 22px 22px; }
          .footer-link { padding: 12px 22px 20px; }
        }
        @media (min-width: 769px) {
          .mobile-hero { display: none; }
        }
      `}</style>

      <div className="page">
        {/* Left panel */}
        <div className="left">
          <div className="left-logo"><Logo /></div>
          <div className="left-copy">
            <div className="tagline">
              Beautiful weddings,<br /><span>perfectly managed.</span>
            </div>
            <p className="tagline-sub">
              Reset your password and get back to managing your events.
            </p>
          </div>
          <div className="features-left">
            <div className="feat"><div className="feat-dot"><Mail size={13} /></div><span>WhatsApp & SMS invitations</span></div>
            <div className="feat"><div className="feat-dot"><CheckCircle size={13} /></div><span>QR code check-in system</span></div>
            <div className="feat"><div className="feat-dot"><Shield size={13} /></div><span>Secure & private</span></div>
            <div className="feat"><div className="feat-dot"><KeyRound size={13} /></div><span>Password recovery</span></div>
          </div>
        </div>

        {/* Right panel */}
        <div className="right">
          <div className="right-inner">
            <div className="card">
              <div className="mobile-hero">
                <div className="mobile-logo-wrap"><Logo /></div>
                <div className="mobile-tagline">Reset <span>Password</span></div>
                <p className="mobile-sub">Enter your email to receive a reset code.</p>
              </div>

              <div className="form-body">
                {step === 1 ? (
                  <>
                    <div className="form-title">Forgot password?</div>
                    <p className="form-subtitle">Enter your email address and we'll send you a code to reset your password.</p>
                    {error && <div className="err-box"><span>⚠️</span><span>{error}</span></div>}
                    {success && <div className="success-box"><span>✓</span><span>{success}</span></div>}
                    <div className="field-wrap">
                      <label className={`field-label ${focused === 'email' || email ? 'up' : ''}`}>Email Address</label>
                      <input
                        type="email"
                        className="field-input"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        onFocus={() => setFocused('email')}
                        onBlur={() => setFocused(null)}
                      />
                    </div>
                    <button className="btn-primary" disabled={loading} onClick={handleSendOtp}>
                      {loading ? <><div className="spinner" /> Sending...</> : 'Send Reset Code'}
                    </button>
                    <Link href="/login" className="btn-secondary" style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}>
                      ← Back to Login
                    </Link>
                  </>
                ) : (
                  <>
                    <div className="form-title">Reset Password</div>
                    <p className="form-subtitle">Enter the code sent to <strong>{email}</strong> and choose a new password.</p>
                    {error && <div className="err-box"><span>⚠️</span><span>{error}</span></div>}
                    {success && <div className="success-box"><span>✓</span><span>{success}</span></div>}
                    <div className="field-wrap">
                      <label className={`field-label ${focused === 'otp' || otp ? 'up' : ''}`}>Verification Code</label>
                      <input
                        className="field-input"
                        value={otp}
                        onChange={e => setOtp(e.target.value.slice(0,6))}
                        onFocus={() => setFocused('otp')}
                        onBlur={() => setFocused(null)}
                        maxLength={6}
                        placeholder="000000"
                      />
                    </div>
                    <div className="field-wrap">
                      <label className={`field-label ${focused === 'newPassword' || newPassword ? 'up' : ''}`}>New Password</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="field-input"
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        onFocus={() => setFocused('newPassword')}
                        onBlur={() => setFocused(null)}
                      />
                    </div>
                    <div className="field-wrap">
                      <label className={`field-label ${focused === 'confirmPassword' || confirmPassword ? 'up' : ''}`}>Confirm Password</label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="field-input"
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        onFocus={() => setFocused('confirmPassword')}
                        onBlur={() => setFocused(null)}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ background: 'none', border: 'none', color: '#0D4F4F', fontSize: '12px', cursor: 'pointer' }}
                      >
                        {showPassword ? 'Hide' : 'Show'} passwords
                      </button>
                    </div>
                    <button className="btn-primary" disabled={loading} onClick={handleResetPassword}>
                      {loading ? <><div className="spinner" /> Resetting...</> : 'Reset Password'}
                    </button>
                    <button className="btn-secondary" onClick={() => setStep(1)}>
                      ← Back to email
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="footer-link">
              Remember your password? <a href="/login">Sign in</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}