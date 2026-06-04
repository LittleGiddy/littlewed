'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Mail, CheckCircle, Globe, Building, ArrowRight } from 'lucide-react';

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    business_name: '',
    subdomain: '',
    email: '',
    password: '',
    name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const set = (key: string, value: string) => {
    setForm(prev => ({
      ...prev,
      [key]: value,
      ...(key === 'business_name' ? {
        subdomain: value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      } : {})
    }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        router.push('/login?registered=true');
      } else {
        setError(data.error || 'Signup failed');
        setLoading(false);
      }
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  const isStep1Valid = form.business_name.trim() && form.subdomain.trim();
  const isStep2Valid = form.name.trim() && form.email.trim() && form.password.length >= 8;

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

        .page { display: flex; min-height: 100vh; }

        /* ── Left panel (desktop only) ── */
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
          to   { opacity: 1; transform: translateY(0); }
        }

        .feat { display: flex; align-items: center; gap: 11px; color: rgba(255,255,255,0.72); font-size: 13.5px; font-weight: 500; }
        .feat-dot {
          width: 27px; height: 27px; border-radius: 8px; flex-shrink: 0;
          background: rgba(232,165,152,0.18); border: 1px solid rgba(232,165,152,0.28);
          display: flex; align-items: center; justify-content: center; color: #E8A598;
        }

        /* ── Right panel ── */
        .right {
          flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 40px 24px; background: #F0F4F8;
          animation: fadeIn 0.6s 0.1s both;
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

        /* ── Mobile hero (hidden on desktop) ── */
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

        .mobile-logo-wrap {
          position: relative; z-index: 2;
          margin-bottom: 20px;
          animation: fadeDown 0.6s 0.1s cubic-bezier(0.16,1,0.3,1) both;
        }

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

        /* Step bar */
        .step-bar-wrap { background: #EEF2F6; height: 4px; }
        .step-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #0D4F4F, #E8A598);
          border-radius: 0 2px 2px 0;
          transition: width 0.4s cubic-bezier(0.4,0,0.2,1);
        }

        /* Form */
        .form-body { padding: 36px 36px 32px; }

        .step-label {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          color: #0D4F4F; text-transform: uppercase; margin-bottom: 6px;
        }
        .form-title {
          font-family: 'Playfair Display', serif; font-size: 24px;
          font-weight: 800; color: #0D1B1B; margin-bottom: 4px; letter-spacing: -0.3px;
        }
        .form-subtitle { font-size: 13.5px; color: #7A8FA6; margin-bottom: 28px; line-height: 1.5; }

        /* Fields */
        .field-wrap { position: relative; margin-bottom: 18px; }
        .field-label {
          position: absolute; left: 15px; top: 50%; transform: translateY(-50%);
          font-size: 14px; color: #9BAAB8; pointer-events: none; background: white;
          padding: 0 4px; font-weight: 500;
          transition: top 0.2s cubic-bezier(0.4,0,0.2,1),
                      font-size 0.2s cubic-bezier(0.4,0,0.2,1),
                      color 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        .field-label.up { top: 0; font-size: 10.5px; color: #0D4F4F; font-weight: 700; letter-spacing: 0.3px; }

        .field-input {
          width: 100%; padding: 15px; border: 1.5px solid #E2EAF0; border-radius: 13px;
          font-size: 14px; font-family: inherit; outline: none; color: #0D1B1B;
          background: white; font-weight: 500;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .field-input:focus { border-color: #0D4F4F; box-shadow: 0 0 0 4px rgba(13,79,79,0.08); }

        .subdomain-wrap {
          display: flex; align-items: center; border: 1.5px solid #E2EAF0;
          border-radius: 13px; overflow: hidden; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .subdomain-wrap:focus-within { border-color: #0D4F4F; box-shadow: 0 0 0 4px rgba(13,79,79,0.08); }
        .subdomain-prefix {
          padding: 15px 11px 15px 15px; background: #F5F8FA; color: #9BAAB8;
          font-size: 12px; font-weight: 600; border-right: 1.5px solid #E2EAF0; white-space: nowrap;
        }
        .subdomain-input {
          flex: 1; padding: 15px 15px 15px 11px; border: none; outline: none;
          font-size: 14px; font-family: inherit; color: #0D1B1B; font-weight: 500; background: white;
        }

        .hint { font-size: 11px; color: #9BAAB8; margin-top: 5px; padding-left: 4px; }
        .hint strong { color: #0D4F4F; }

        .pw-eye {
          position: absolute; right: 13px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #9BAAB8;
          display: flex; align-items: center; padding: 4px; transition: color 0.15s;
        }
        .pw-eye:hover { color: #0D4F4F; }

        .pw-strength { display: flex; gap: 4px; margin-top: 7px; }
        .pw-bar { flex: 1; height: 3px; border-radius: 2px; background: #E2EAF0; transition: background 0.3s; }

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

        .btn-primary {
          width: 100%; padding: 15px; border: none; border-radius: 13px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 15px; font-weight: 700; font-family: inherit;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 16px rgba(13,79,79,0.35);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
          letter-spacing: 0.2px; position: relative; overflow: hidden;
        }
        .btn-primary::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
          opacity: 0; transition: opacity 0.2s;
        }
        .btn-primary:hover:not(:disabled)::after { opacity: 1; }
        .btn-primary:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(13,79,79,0.4); }
        .btn-primary:active:not(:disabled) { transform: translateY(0); }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-secondary {
          width: 100%; padding: 14px; border: 1.5px solid #E2EAF0; border-radius: 13px;
          background: white; color: #4A6072; font-size: 14px; font-weight: 600;
          font-family: inherit; cursor: pointer;
          transition: border-color 0.15s, background 0.15s, color 0.15s;
          margin-top: 10px;
        }
        .btn-secondary:hover { border-color: #0D4F4F; color: #0D4F4F; background: #F5FAF9; }

        .spinner {
          width: 17px; height: 17px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .step-dots {
          display: flex; gap: 6px; justify-content: center;
          padding: 18px 0 0; border-top: 1px solid #F0F4F8; margin-top: 22px;
        }
        .dot { width: 6px; height: 6px; border-radius: 50%; background: #E2EAF0; transition: all 0.3s; }
        .dot.active { width: 20px; border-radius: 3px; background: #0D4F4F; }

        .footer-link { text-align: center; font-size: 13px; color: #7A8FA6; padding: 16px 36px 28px; }
        .footer-link a { color: #0D4F4F; font-weight: 700; text-decoration: none; }
        .footer-link a:hover { text-decoration: underline; }

        /* Mobile bottom feature list */
        .mobile-bottom {
          padding: 22px 20px 36px;
          display: flex; flex-direction: column; gap: 10px;
          animation: fadeUp 0.5s 0.4s cubic-bezier(0.16,1,0.3,1) both;
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

        /* ── Mobile breakpoint ── */
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
            animation: cardInMobile 0.6s 0.05s cubic-bezier(0.16,1,0.3,1) both;
          }

          @keyframes cardInMobile {
            from { opacity: 0; transform: translateY(-24px); }
            to   { opacity: 1; transform: translateY(0); }
          }

          .mobile-hero { display: flex; }
          .form-body { padding: 26px 22px 22px; }
          .footer-link { padding: 12px 22px 20px; }
        }

        @media (min-width: 769px) {
          .mobile-hero { display: none; }
          .mobile-bottom { display: none; }
        }
      `}</style>

      <div className="page">

        {/* ── Desktop left panel ── */}
        <div className="left">
          <div className="left-logo"><Logo /></div>

          <div className="left-copy">
            <div className="tagline">
              Beautiful weddings,<br /><span>perfectly managed.</span>
            </div>
            <p className="tagline-sub">
              Create your workspace and start managing guest lists, invitations, and check-ins in minutes.
            </p>
          </div>

          <div className="features-left">
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

              {/* Mobile hero — same teal branding as desktop left panel */}
              <div className="mobile-hero">
                <div className="mobile-logo-wrap"><Logo /></div>
                <div className="mobile-tagline">
                  Beautiful weddings,<br /><span>perfectly managed.</span>
                </div>
                <p className="mobile-sub">
                  Create your workspace and start managing guests, invitations, and check-ins.
                </p>
                <div className="mobile-pills">
                  {features.map(({ icon, label }) => (
                    <div className="pill" key={label}>
                      {icon}<span>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Progress bar */}
              <div className="step-bar-wrap">
                <div className="step-bar-fill" style={{ width: step === 1 ? '50%' : '100%' }} />
              </div>

              {/* Form */}
              <div className="form-body">
                {step === 1 ? (
                  <>
                    <div className="step-label">Step 1 of 2</div>
                    <div className="form-title">Your Workspace</div>
                    <p className="form-subtitle">Set up your business profile and unique URL.</p>

                    {error && <div className="err-box"><span>⚠️</span><span>{error}</span></div>}

                    <div className="field-wrap">
                      <label className={`field-label ${focused === 'business_name' || form.business_name ? 'up' : ''}`}>
                        Business Name
                      </label>
                      <input
                        className="field-input"
                        value={form.business_name}
                        onChange={e => set('business_name', e.target.value)}
                        onFocus={() => setFocused('business_name')}
                        onBlur={() => setFocused(null)}
                      />
                    </div>

                    <div className="field-wrap">
                      <div className="subdomain-wrap">
                        <div className="subdomain-prefix">littlewed.com /</div>
                        <input
                          className="subdomain-input"
                          placeholder="your-name"
                          value={form.subdomain}
                          onChange={e => set('subdomain', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        />
                      </div>
                      {form.subdomain && (
                        <div className="hint">Your URL: <strong>{form.subdomain}.littlewed.com</strong></div>
                      )}
                    </div>

                    <button
                      className="btn-primary"
                      disabled={!isStep1Valid}
                      onClick={() => { setError(''); setStep(2); }}
                    >
                      Continue <ArrowRight size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="step-label">Step 2 of 2</div>
                    <div className="form-title">Your Account</div>
                    <p className="form-subtitle">Create your login credentials.</p>

                    {error && <div className="err-box"><span>⚠️</span><span>{error}</span></div>}

                    <div className="field-wrap">
                      <label className={`field-label ${focused === 'name' || form.name ? 'up' : ''}`}>
                        Full Name
                      </label>
                      <input
                        className="field-input"
                        value={form.name}
                        onChange={e => set('name', e.target.value)}
                        onFocus={() => setFocused('name')}
                        onBlur={() => setFocused(null)}
                      />
                    </div>

                    <div className="field-wrap">
                      <label className={`field-label ${focused === 'email' || form.email ? 'up' : ''}`}>
                        Email Address
                      </label>
                      <input
                        type="email"
                        className="field-input"
                        value={form.email}
                        onChange={e => set('email', e.target.value)}
                        onFocus={() => setFocused('email')}
                        onBlur={() => setFocused(null)}
                      />
                    </div>

                    <div className="field-wrap">
                      <label className={`field-label ${focused === 'password' || form.password ? 'up' : ''}`}>
                        Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="field-input"
                        style={{ paddingRight: 44 }}
                        value={form.password}
                        onChange={e => set('password', e.target.value)}
                        onFocus={() => setFocused('password')}
                        onBlur={() => setFocused(null)}
                      />
                      <button
                        type="button"
                        className="pw-eye"
                        onClick={() => setShowPassword(s => !s)}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>

                      {form.password && (
                        <div className="pw-strength">
                          {[1, 2, 3, 4].map(i => {
                            const strength = Math.min(4, Math.floor(form.password.length / 3));
                            const colors = ['#E05C5C', '#F0A500', '#3AB795', '#0D4F4F'];
                            return (
                              <div key={i} className="pw-bar"
                                style={{ background: i <= strength ? colors[strength - 1] : undefined }}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <button
                      className="btn-primary"
                      disabled={!isStep2Valid || loading}
                      onClick={handleSubmit}
                    >
                      {loading
                        ? <><div className="spinner" /> Creating account…</>
                        : <>Create Account <ArrowRight size={16} /></>
                      }
                    </button>

                    <button className="btn-secondary" onClick={() => setStep(1)}>
                      ← Back
                    </button>
                  </>
                )}

                <div className="step-dots">
                  <div className={`dot ${step === 1 ? 'active' : ''}`} />
                  <div className={`dot ${step === 2 ? 'active' : ''}`} />
                </div>
              </div>
            </div>

            <div className="footer-link">
              Already have an account? <a href="/login">Sign in</a>
            </div>

            {/* Mobile bottom features */}
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