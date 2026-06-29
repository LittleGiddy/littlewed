'use client';
import { useEffect, useState } from 'react';
import { Coins, TrendingUp, MessageCircle, Phone, Plus, ChevronRight, Minus, Sparkles, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

const CREDIT_COST = 300;

const PRESETS = [
  { credits: 10,  badge: null,          popular: false },
  { credits: 25,  badge: 'Popular',     popular: true  },
  { credits: 50,  badge: 'Best value',  popular: false },
  { credits: 100, badge: null,          popular: false },
];

export default function BillingPage() {
  const [balance, setBalance] = useState<number | null>(null);
  const [usage, setUsage] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [selectedCredits, setSelectedCredits] = useState(25);
  const [customMode, setCustomMode] = useState(false);
  const [customCredits, setCustomCredits] = useState('');
  const [purchasing, setPurchasing] = useState(false);

  const loadData = async () => {
    setLoadingData(true);
    try {
      const res = await fetch('/api/tenant/billing');
      const data = await res.json();
      setBalance(data.tenant?.credits ?? data.tenant?.creditBalance ?? 0);
      setUsage(data.usage || []);
    } catch {
      toast.error('Failed to load billing data');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const activeCredits = customMode
    ? Math.max(1, parseInt(customCredits || '0', 10) || 0)
    : selectedCredits;

  const totalTZS = activeCredits * CREDIT_COST;

  const handlePurchase = async () => {
    if (activeCredits < 1) { toast.error('Select at least 1 credit'); return; }
    setPurchasing(true);
    try {
      const res = await fetch('/api/tenant/purchase-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalTZS, returnUrl: '/client/billing' }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error(data.error || 'Failed to initiate payment');
        setPurchasing(false);
      }
    } catch {
      toast.error('Network error');
      setPurchasing(false);
    }
  };

  const totalSpent = usage.reduce((sum: number, u: any) => sum + (u.cost || 0), 0);
  const whatsappCount = usage.filter((u: any) => u.channel === 'whatsapp').length;
  const smsCount = usage.filter((u: any) => u.channel === 'sms').length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');
        *, *::before, *::after { box-sizing: border-box; }

        .bl-wrap {
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          max-width: 720px; margin: 0 auto; padding: 40px 24px 72px;
          animation: blFadeIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes blFadeIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Page header ── */
        .bl-eyebrow {
          font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
          color: #0D4F4F; text-transform: uppercase; margin-bottom: 6px;
          display: flex; align-items: center; gap: 7px;
        }
        .bl-eyebrow-dot { width: 5px; height: 5px; border-radius: 50%; background: #E8A598; }
        .bl-page-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 28px; gap: 16px; flex-wrap: wrap;
        }
        .bl-title {
          font-family: 'Playfair Display', serif;
          font-size: 30px; font-weight: 900; color: #0D1B1B;
          line-height: 1.1; letter-spacing: -0.4px; margin: 0 0 5px;
        }
        .bl-title span { color: #E8A598; }
        .bl-subtitle { font-size: 14px; color: #7A8FA6; margin: 0; line-height: 1.6; }

        .bl-refresh-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 10px 16px; border: 1.5px solid #E2EAF0; border-radius: 12px;
          background: white; color: #4A6072; font-size: 13px; font-weight: 700;
          font-family: inherit; cursor: pointer; flex-shrink: 0; align-self: flex-start;
          transition: border-color 0.15s, color 0.15s;
        }
        .bl-refresh-btn:hover { border-color: #0D4F4F; color: #0D4F4F; }
        .bl-refresh-btn.spinning svg { animation: blSpin 0.8s linear infinite; }
        @keyframes blSpin { to { transform: rotate(360deg); } }

        /* ── Card base ── */
        .bl-card {
          background: white; border: 1.5px solid #E2EAF0; border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.05);
          margin-bottom: 20px;
          animation: blCardIn 0.5s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes blCardIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .bl-card-bar { height: 4px; }
        .bl-card-bar.teal   { background: linear-gradient(90deg, #0D4F4F, #E8A598); }
        .bl-card-bar.green  { background: linear-gradient(90deg, #1A7A4A, #3AB795); }
        .bl-card-body { padding: 24px 28px; }

        /* ── Balance hero ── */
        .bl-balance-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
        }
        .bl-balance-left {}
        .bl-balance-label { font-size: 12px; font-weight: 600; color: #9BAAB8; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
        .bl-balance-amount {
          font-family: 'Playfair Display', serif;
          font-size: 52px; font-weight: 900; color: #0D4F4F;
          line-height: 1; letter-spacing: -1px;
        }
        .bl-balance-unit { font-size: 18px; color: #9BAAB8; font-weight: 600; margin-left: 6px; font-family: 'DM Sans', sans-serif; }

        .bl-balance-icon-wrap {
          width: 72px; height: 72px; border-radius: 20px; flex-shrink: 0;
          background: linear-gradient(135deg, rgba(13,79,79,0.1), rgba(13,79,79,0.05));
          border: 1.5px solid rgba(13,79,79,0.12);
          display: flex; align-items: center; justify-content: center; color: #0D4F4F;
        }

        .bl-balance-sub-stats {
          display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap;
        }
        .bl-mini-stat {
          display: flex; align-items: center; gap: 7px;
          background: #F7F9FB; border: 1px solid #E2EAF0; border-radius: 10px;
          padding: 8px 14px; font-size: 12.5px; font-weight: 600; color: #4A6072;
        }

        /* ── Purchase section ── */
        .bl-section-title {
          font-family: 'Playfair Display', serif;
          font-size: 17px; font-weight: 800; color: #0D1B1B; letter-spacing: -0.2px;
          margin-bottom: 16px;
        }

        .bl-presets {
          display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px;
        }

        .bl-preset {
          position: relative; border-radius: 14px; padding: 14px 10px 12px;
          border: 1.5px solid #E2EAF0; background: white;
          cursor: pointer; text-align: center;
          transition: border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s;
        }
        .bl-preset:hover {
          border-color: rgba(13,79,79,0.35);
          transform: translateY(-2px); box-shadow: 0 4px 12px rgba(13,79,79,0.1);
        }
        .bl-preset.selected {
          border-color: #0D4F4F; background: rgba(13,79,79,0.04);
          box-shadow: 0 0 0 4px rgba(13,79,79,0.08);
        }
        .bl-preset.popular { border-color: rgba(232,165,152,0.6); }
        .bl-preset.popular.selected { border-color: #0D4F4F; }

        .bl-preset-badge {
          position: absolute; top: -9px; left: 50%; transform: translateX(-50%);
          font-size: 8.5px; font-weight: 800; letter-spacing: 0.5px;
          text-transform: uppercase; padding: 2px 8px; border-radius: 20px;
          white-space: nowrap;
        }
        .bl-preset-badge.pop  { background: #E8A598; color: white; }
        .bl-preset-badge.best { background: #0D4F4F; color: white; }

        .bl-preset-num {
          font-family: 'Playfair Display', serif;
          font-size: 22px; font-weight: 900; color: #0D1B1B; line-height: 1;
        }
        .bl-preset-clabel { font-size: 10px; font-weight: 600; color: #9BAAB8; margin: 2px 0 8px; text-transform: uppercase; letter-spacing: 0.5px; }
        .bl-preset-price { font-size: 11.5px; font-weight: 700; color: #0D4F4F; }

        .bl-preset-check {
          position: absolute; top: 7px; right: 7px;
          width: 16px; height: 16px; border-radius: 50%;
          background: #0D4F4F; display: flex; align-items: center; justify-content: center;
          opacity: 0; transform: scale(0.5); transition: opacity 0.15s, transform 0.15s;
        }
        .bl-preset.selected .bl-preset-check { opacity: 1; transform: scale(1); }
        .bl-preset-check::after {
          content: ''; width: 4px; height: 7px;
          border: 2px solid white; border-top: none; border-left: none;
          transform: rotate(45deg) translateY(-1px);
        }

        /* Custom toggle */
        .bl-custom-toggle {
          display: flex; align-items: center; justify-content: space-between;
          padding: 12px 16px; border: 1.5px solid #E2EAF0; border-radius: 13px;
          cursor: pointer; background: white; font-family: inherit; width: 100%;
          margin-bottom: 12px;
          transition: border-color 0.15s, background 0.15s;
        }
        .bl-custom-toggle:hover { border-color: rgba(13,79,79,0.3); }
        .bl-custom-toggle.active { border-color: #0D4F4F; background: rgba(13,79,79,0.02); }
        .bl-custom-toggle-label { font-size: 13.5px; font-weight: 600; color: #4A6072; }
        .bl-custom-chevron { color: #9BAAB8; transition: transform 0.2s; }
        .bl-custom-toggle.active .bl-custom-chevron { transform: rotate(90deg); }

        .bl-custom-row {
          display: flex; align-items: center; gap: 10px;
          padding: 12px 14px; border: 1.5px solid #0D4F4F; border-radius: 13px;
          background: rgba(13,79,79,0.02); margin-bottom: 12px;
          box-shadow: 0 0 0 4px rgba(13,79,79,0.06);
          animation: blSlideIn 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes blSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .bl-stepper {
          width: 30px; height: 30px; border-radius: 8px; flex-shrink: 0;
          border: 1.5px solid #E2EAF0; background: white; cursor: pointer;
          display: flex; align-items: center; justify-content: center; color: #0D4F4F;
          transition: border-color 0.15s;
        }
        .bl-stepper:hover { border-color: #0D4F4F; }
        .bl-custom-input {
          flex: 1; text-align: center; border: none; outline: none; background: transparent;
          font-size: 20px; font-weight: 800; color: #0D1B1B;
          font-family: 'Playfair Display', serif;
        }
        .bl-custom-unit { font-size: 12px; font-weight: 700; color: #9BAAB8; flex-shrink: 0; }

        /* Summary + CTA */
        .bl-purchase-bottom {
          display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
        }
        .bl-summary-pill {
          display: flex; align-items: center; gap: 10px;
          background: rgba(13,79,79,0.05); border: 1.5px solid rgba(13,79,79,0.12);
          border-radius: 14px; padding: 12px 18px; flex: 1; min-width: 160px;
        }
        .bl-summary-col {}
        .bl-summary-micro { font-size: 11px; color: #9BAAB8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; }
        .bl-summary-val {
          font-family: 'Playfair Display', serif;
          font-size: 20px; font-weight: 900; color: #0D4F4F; line-height: 1.1;
        }
        .bl-summary-sep { width: 1px; height: 32px; background: rgba(13,79,79,0.12); flex-shrink: 0; }

        .bl-pay-btn {
          padding: 14px 28px; border: none; border-radius: 13px;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 15px; font-weight: 700; font-family: inherit;
          cursor: pointer; display: flex; align-items: center; gap: 8px;
          box-shadow: 0 4px 14px rgba(13,79,79,0.35); white-space: nowrap;
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
          flex-shrink: 0;
        }
        .bl-pay-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(13,79,79,0.42); }
        .bl-pay-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        .bl-spinner {
          width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: blSpin 0.7s linear infinite; flex-shrink: 0;
        }

        .bl-rate-note { font-size: 11.5px; color: #B0BEC8; margin-top: 12px; line-height: 1.5; }
        .bl-rate-note strong { color: #7A8FA6; }

        /* ── Usage section ── */
        .bl-usage-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 16px; flex-wrap: wrap; gap: 10px;
        }
        .bl-usage-badge {
          font-size: 11px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.08); border: 1px solid rgba(13,79,79,0.12);
          padding: 3px 10px; border-radius: 20px;
        }

        .bl-table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
        .bl-table th {
          padding: 10px 14px; text-align: left; background: #F7F9FB;
          font-size: 10.5px; font-weight: 700; letter-spacing: 1px;
          color: #9BAAB8; text-transform: uppercase; border-bottom: 1.5px solid #F0F4F8;
        }
        .bl-table th:last-child { text-align: right; }
        .bl-table td { padding: 13px 14px; border-bottom: 1px solid #F7F9FB; vertical-align: middle; }
        .bl-table td:last-child { text-align: right; font-weight: 700; color: #0D1B1B; }
        .bl-table tr:last-child td { border-bottom: none; }
        .bl-table tbody tr { transition: background 0.12s; }
        .bl-table tbody tr:hover { background: #F7FAFA; }

        .bl-event-name { font-weight: 700; color: #0D1B1B; }
        .bl-date { color: #9BAAB8; font-size: 12px; }

        .bl-channel-pill {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11.5px; font-weight: 700; padding: 3px 10px; border-radius: 20px;
        }
        .bl-channel-pill.whatsapp { color: #0D4F4F; background: rgba(13,79,79,0.08); border: 1px solid rgba(13,79,79,0.15); }
        .bl-channel-pill.sms      { color: #C07A20; background: rgba(192,122,32,0.08); border: 1px solid rgba(192,122,32,0.2); }

        .bl-empty {
          padding: 48px 24px; text-align: center;
        }
        .bl-empty-icon {
          width: 52px; height: 52px; border-radius: 15px; margin: 0 auto 14px;
          background: rgba(13,79,79,0.06); border: 1.5px solid rgba(13,79,79,0.1);
          display: flex; align-items: center; justify-content: center; color: #0D4F4F;
        }
        .bl-empty-title {
          font-family: 'Playfair Display', serif;
          font-size: 16px; font-weight: 800; color: #0D1B1B; margin-bottom: 5px;
        }
        .bl-empty-sub { font-size: 13px; color: #9BAAB8; }

        /* Skeleton */
        .bl-skeleton { background: #F0F4F8; border-radius: 8px; animation: blShimmer 1.4s ease-in-out infinite; }
        @keyframes blShimmer { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }

        @media (max-width: 560px) {
          .bl-wrap { padding: 24px 16px 56px; }
          .bl-title { font-size: 26px; }
          .bl-presets { grid-template-columns: 1fr 1fr; }
          .bl-balance-amount { font-size: 40px; }
          .bl-card-body { padding: 20px; }
          .bl-purchase-bottom { flex-direction: column; align-items: stretch; }
          .bl-pay-btn { justify-content: center; }
          .bl-summary-pill { flex: unset; width: 100%; }
        }
      `}</style>

      <div className="bl-wrap">

        {/* Page header */}
        <div className="bl-page-header">
          <div>
            <div className="bl-eyebrow"><div className="bl-eyebrow-dot" />Billing</div>
            <h1 className="bl-title">Credits &amp; <span>Billing</span></h1>
            <p className="bl-subtitle">Purchase credits to send invitations via WhatsApp or SMS.</p>
          </div>
          <button
            className={`bl-refresh-btn${loadingData ? ' spinning' : ''}`}
            onClick={loadData}
            disabled={loadingData}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {/* ── Balance card ── */}
        <div className="bl-card" style={{ animationDelay: '0ms' }}>
          <div className="bl-card-bar teal" />
          <div className="bl-card-body">
            <div className="bl-balance-row">
              <div className="bl-balance-left">
                <div className="bl-balance-label">Available balance</div>
                {loadingData ? (
                  <div className="bl-skeleton" style={{ width: 140, height: 52, borderRadius: 10, marginBottom: 4 }} />
                ) : (
                  <div className="bl-balance-amount">
                    {balance?.toLocaleString() ?? 0}
                    <span className="bl-balance-unit">credits</span>
                  </div>
                )}
              </div>
              <div className="bl-balance-icon-wrap">
                <Coins size={32} />
              </div>
            </div>

            <div className="bl-balance-sub-stats">
              <div className="bl-mini-stat">
                <MessageCircle size={13} style={{ color: '#0D4F4F' }} />
                WhatsApp: <strong style={{ color: '#0D1B1B', marginLeft: 3 }}>{whatsappCount}</strong>
              </div>
              <div className="bl-mini-stat">
                <Phone size={13} style={{ color: '#C07A20' }} />
                SMS: <strong style={{ color: '#0D1B1B', marginLeft: 3 }}>{smsCount}</strong>
              </div>
              <div className="bl-mini-stat">
                <TrendingUp size={13} style={{ color: '#6B3FA0' }} />
                Total spent: <strong style={{ color: '#0D1B1B', marginLeft: 3 }}>{totalSpent.toLocaleString()} TZS</strong>
              </div>
            </div>
          </div>
        </div>

        {/* ── Purchase card ── */}
        <div className="bl-card" style={{ animationDelay: '80ms' }}>
          <div className="bl-card-bar teal" />
          <div className="bl-card-body">
            <div className="bl-section-title">Purchase Credits</div>

            {/* Preset grid */}
            <div className="bl-presets">
              {PRESETS.map(p => (
                <button
                  key={p.credits}
                  className={`bl-preset${selectedCredits === p.credits && !customMode ? ' selected' : ''}${p.popular ? ' popular' : ''}`}
                  onClick={() => { setSelectedCredits(p.credits); setCustomMode(false); }}
                >
                  {p.badge && (
                    <span className={`bl-preset-badge ${p.badge === 'Popular' ? 'pop' : 'best'}`}>{p.badge}</span>
                  )}
                  <div className="bl-preset-check" />
                  <div className="bl-preset-num">{p.credits}</div>
                  <div className="bl-preset-clabel">credits</div>
                  <div className="bl-preset-price">{(p.credits * CREDIT_COST).toLocaleString()} TZS</div>
                </button>
              ))}
            </div>

            {/* Custom toggle */}
            <button
              className={`bl-custom-toggle${customMode ? ' active' : ''}`}
              onClick={() => setCustomMode(m => !m)}
            >
              <span className="bl-custom-toggle-label">Custom amount</span>
              <ChevronRight size={15} className="bl-custom-chevron" />
            </button>

            {/* Custom stepper */}
            {customMode && (
              <div className="bl-custom-row">
                <button className="bl-stepper" onClick={() => setCustomCredits(c => String(Math.max(1, (parseInt(c || '0') || 0) - 1)))}>
                  <Minus size={13} />
                </button>
                <input
                  type="number"
                  className="bl-custom-input"
                  value={customCredits}
                  onChange={e => setCustomCredits(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="0"
                  min="1"
                />
                <span className="bl-custom-unit">credits</span>
                <button className="bl-stepper" onClick={() => setCustomCredits(c => String((parseInt(c || '0') || 0) + 1))}>
                  <Plus size={13} />
                </button>
              </div>
            )}

            {/* Summary + pay */}
            <div className="bl-purchase-bottom">
              <div className="bl-summary-pill">
                <div className="bl-summary-col">
                  <div className="bl-summary-micro">Credits</div>
                  <div className="bl-summary-val">{activeCredits > 0 ? activeCredits : '—'}</div>
                </div>
                <div className="bl-summary-sep" />
                <div className="bl-summary-col">
                  <div className="bl-summary-micro">Total</div>
                  <div className="bl-summary-val" style={{ color: '#0D1B1B' }}>
                    {activeCredits > 0 ? `${totalTZS.toLocaleString()} TZS` : '—'}
                  </div>
                </div>
              </div>

              <button
                className="bl-pay-btn"
                onClick={handlePurchase}
                disabled={purchasing || activeCredits < 1}
              >
                {purchasing
                  ? <><div className="bl-spinner" /> Processing…</>
                  : <><Sparkles size={15} /> Pay {activeCredits > 0 ? `${totalTZS.toLocaleString()} TZS` : 'Now'}</>
                }
              </button>
            </div>

            <p className="bl-rate-note">
              1 credit = <strong>300 TZS</strong> &nbsp;·&nbsp; Secure checkout via ClickPesa
            </p>
          </div>
        </div>

        {/* ── Usage card ── */}
        <div className="bl-card" style={{ animationDelay: '160ms' }}>
          <div className="bl-card-bar green" />
          <div className="bl-card-body">
            <div className="bl-usage-header">
              <div className="bl-section-title" style={{ marginBottom: 0 }}>Recent Usage</div>
              {usage.length > 0 && (
                <div className="bl-usage-badge">{usage.length} record{usage.length !== 1 ? 's' : ''}</div>
              )}
            </div>

            {loadingData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1,2,3].map(i => (
                  <div key={i} style={{ display: 'flex', gap: 10 }}>
                    <div className="bl-skeleton" style={{ height: 14, flex: 1, borderRadius: 6 }} />
                    <div className="bl-skeleton" style={{ height: 14, width: 80, borderRadius: 6 }} />
                    <div className="bl-skeleton" style={{ height: 14, width: 60, borderRadius: 6 }} />
                  </div>
                ))}
              </div>
            ) : usage.length === 0 ? (
              <div className="bl-empty">
                <div className="bl-empty-icon"><TrendingUp size={22} /></div>
                <div className="bl-empty-title">No usage yet</div>
                <p className="bl-empty-sub">Send invitations to see usage records here.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="bl-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Event</th>
                      <th>Channel</th>
                      <th>Cost (TZS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.map((u: any) => (
                      <tr key={u.id}>
                        <td><div className="bl-date">{new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div></td>
                        <td><div className="bl-event-name">{u.event?.name || '—'}</div></td>
                        <td>
                          <span className={`bl-channel-pill ${u.channel === 'whatsapp' ? 'whatsapp' : 'sms'}`}>
                            {u.channel === 'whatsapp'
                              ? <><MessageCircle size={11} /> WhatsApp</>
                              : <><Phone size={11} /> SMS</>
                            }
                          </span>
                        </td>
                        <td>{(u.cost || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  );
}