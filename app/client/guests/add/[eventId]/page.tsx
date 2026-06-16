'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Phone, User, ArrowLeft, ArrowRight } from 'lucide-react';

export default function AddGuestPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focused, setFocused] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, eventId }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/client/events/${eventId}`);
      } else {
        setError(data.error || 'Failed to add guest');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const isValid = name.trim() && phone.trim();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .ag-wrap {
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          max-width: 480px;
          margin: 0 auto;
          padding: 48px 24px 64px;
          animation: agFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }

        @keyframes agFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* Back link */
        .ag-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: 13px; font-weight: 700; color: #0D4F4F;
          text-decoration: none; margin-bottom: 28px;
          transition: opacity 0.15s, gap 0.15s;
        }
        .ag-back:hover { opacity: 0.7; gap: 4px; }

        /* Header */
        .ag-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          color: #0D4F4F; text-transform: uppercase; margin-bottom: 6px;
          display: flex; align-items: center; gap: 7px;
        }
        .ag-eyebrow-dot { width: 5px; height: 5px; border-radius: 50%; background: #E8A598; }

        .ag-title {
          font-family: 'Playfair Display', serif;
          font-size: 30px; font-weight: 900; color: #0D1B1B;
          line-height: 1.15; letter-spacing: -0.4px; margin: 0 0 6px;
        }
        .ag-title span { color: #E8A598; }

        .ag-subtitle { font-size: 14px; color: #7A8FA6; line-height: 1.6; margin: 0 0 28px; }

        /* Card */
        .ag-card {
          background: white; border: 1.5px solid #E2EAF0; border-radius: 22px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06);
          overflow: hidden;
          animation: agCardIn 0.55s 0.1s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes agCardIn {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        .ag-card-bar { height: 4px; background: linear-gradient(90deg, #0D4F4F, #E8A598); }
        .ag-card-body { padding: 32px 32px 28px; }

        /* Fields */
        .ag-field { position: relative; margin-bottom: 20px; }

        .ag-label {
          position: absolute; left: 46px; top: 50%; transform: translateY(-50%);
          font-size: 14px; color: #9BAAB8; pointer-events: none; background: white;
          padding: 0 4px; font-weight: 500;
          transition: top 0.2s cubic-bezier(0.4,0,0.2,1),
                      font-size 0.2s cubic-bezier(0.4,0,0.2,1),
                      color 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        .ag-label.up { top: 0; font-size: 10.5px; color: #0D4F4F; font-weight: 700; letter-spacing: 0.3px; }

        .ag-input-wrap {
          display: flex; align-items: center;
          border: 1.5px solid #E2EAF0; border-radius: 13px;
          transition: border-color 0.2s, box-shadow 0.2s;
          background: white; overflow: hidden;
        }
        .ag-input-wrap.focused {
          border-color: #0D4F4F;
          box-shadow: 0 0 0 4px rgba(13,79,79,0.08);
        }

        .ag-input-icon {
          width: 46px; display: flex; align-items: center; justify-content: center;
          color: #C8D4DE; flex-shrink: 0;
          transition: color 0.2s;
        }
        .ag-input-wrap.focused .ag-input-icon { color: #0D4F4F; }

        .ag-input {
          flex: 1; padding: 15px 15px 15px 0; border: none; outline: none;
          font-size: 14px; font-family: inherit; color: #0D1B1B;
          font-weight: 500; background: transparent;
        }

        .ag-hint { font-size: 11px; color: #9BAAB8; margin-top: 5px; padding-left: 46px; }
        .ag-hint strong { color: #0D4F4F; }

        /* Error */
        .ag-error {
          background: #FEF2F2; border: 1px solid #FECACA; color: #C0392B;
          padding: 11px 14px; border-radius: 11px; font-size: 13px; font-weight: 600;
          margin-bottom: 20px; display: flex; gap: 8px; align-items: flex-start;
          animation: shake 0.35s ease;
        }
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-6px); }
          60%      { transform: translateX(6px); }
          80%      { transform: translateX(-3px); }
        }

        /* Button */
        .ag-btn {
          width: 100%; padding: 15px; border: none; border-radius: 13px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 15px; font-weight: 700; font-family: inherit;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 16px rgba(13,79,79,0.35);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
          letter-spacing: 0.2px; position: relative; overflow: hidden;
        }
        .ag-btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
          opacity: 0; transition: opacity 0.2s;
        }
        .ag-btn:hover:not(:disabled)::after { opacity: 1; }
        .ag-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(13,79,79,0.4); }
        .ag-btn:active:not(:disabled) { transform: translateY(0); }
        .ag-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .ag-spinner {
          width: 17px; height: 17px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: spin 0.7s linear infinite; flex-shrink: 0;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 540px) {
          .ag-wrap { padding: 28px 16px 48px; }
          .ag-title { font-size: 26px; }
          .ag-card-body { padding: 24px 20px 22px; }
        }
      `}</style>

      <div className="ag-wrap">
        {/* Back link */}
        <Link href={`/client/events/${eventId}`} className="ag-back">
          <ArrowLeft size={14} /> Back to Event
        </Link>

        {/* Header */}
        <div className="ag-eyebrow">
          <div className="ag-eyebrow-dot" />
          Guest Management
        </div>
        <h1 className="ag-title">Add a <span>Guest</span></h1>
        <p className="ag-subtitle">Fill in the guest's details to add them to this event.</p>

        {/* Card */}
        <div className="ag-card">
          <div className="ag-card-bar" />
          <div className="ag-card-body">

            {error && (
              <div className="ag-error"><span>⚠️</span><span>{error}</span></div>
            )}

            <form onSubmit={handleSubmit} noValidate>
              {/* Name field */}
              <div className="ag-field">
                <label className={`ag-label ${focused === 'name' || name ? 'up' : ''}`}>Full Name</label>
                <div className={`ag-input-wrap ${focused === 'name' ? 'focused' : ''}`}>
                  <div className="ag-input-icon"><User size={16} /></div>
                  <input
                    type="text"
                    className="ag-input"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onFocus={() => setFocused('name')}
                    onBlur={() => setFocused(null)}
                    autoComplete="name"
                    required
                  />
                </div>
              </div>

              {/* Phone field */}
              <div className="ag-field">
                <label className={`ag-label ${focused === 'phone' || phone ? 'up' : ''}`}>Phone Number</label>
                <div className={`ag-input-wrap ${focused === 'phone' ? 'focused' : ''}`}>
                  <div className="ag-input-icon"><Phone size={16} /></div>
                  <input
                    type="tel"
                    className="ag-input"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onFocus={() => setFocused('phone')}
                    onBlur={() => setFocused(null)}
                    autoComplete="tel"
                    required
                  />
                </div>
                <div className="ag-hint">Include country code, e.g. <strong>+255712345678</strong></div>
              </div>

              <button type="submit" className="ag-btn" disabled={!isValid || loading}>
                {loading
                  ? <><div className="ag-spinner" /> Adding Guest…</>
                  : <><UserPlus size={16} /> Add Guest</>
                }
              </button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}