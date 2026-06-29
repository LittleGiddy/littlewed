'use client';
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Coins, ChevronRight, Minus, Plus, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits?: number;
  requiredCredits?: number;
  returnUrl?: string;
}

const CREDIT_COST = 300; // TZS per credit

const PRESETS = [
  { credits: 10,  label: '10 credits',  badge: null,        popular: false },
  { credits: 25,  label: '25 credits',  badge: 'Popular',   popular: true  },
  { credits: 50,  label: '50 credits',  badge: 'Best value', popular: false },
  { credits: 100, label: '100 credits', badge: null,        popular: false },
];

export default function BuyCreditsModal({
  isOpen,
  onClose,
  currentCredits = 0,
  requiredCredits = 0,
  returnUrl = '/client/dashboard',
}: BuyCreditsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [selectedCredits, setSelectedCredits] = useState(25);
  const [customMode, setCustomMode] = useState(false);
  const [customCredits, setCustomCredits] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-select the right tier based on deficit
  useEffect(() => {
    if (requiredCredits > 0 && currentCredits !== undefined) {
      const deficit = requiredCredits - currentCredits;
      if (deficit > 0) {
        const nearest = PRESETS.find(p => p.credits >= deficit) ?? PRESETS[PRESETS.length - 1];
        setSelectedCredits(nearest.credits);
      }
    }
  }, [requiredCredits, currentCredits]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const activeCredits = customMode
    ? Math.max(1, parseInt(customCredits || '0', 10) || 0)
    : selectedCredits;

  const totalTZS = activeCredits * CREDIT_COST;
  const deficit = requiredCredits - currentCredits;
  const isDeficit = deficit > 0;

  const handlePurchase = async () => {
    if (activeCredits < 1) { toast.error('Please select at least 1 credit'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/tenant/purchase-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: totalTZS, returnUrl }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error(data.error || 'Failed to initiate payment');
        setLoading(false);
      }
    } catch {
      toast.error('Network error');
      setLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800;900&display=swap');

        .bcm-overlay {
          position: fixed; inset: 0;
          background: rgba(13, 27, 27, 0.55);
          backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 9999; padding: 20px;
          animation: bcmOverlayIn 0.2s ease both;
        }
        @keyframes bcmOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        .bcm-modal {
          background: white;
          border-radius: 28px;
          width: 100%; max-width: 420px;
          max-height: 92vh; overflow-y: auto;
          box-shadow: 0 8px 32px rgba(0,0,0,0.18), 0 40px 80px rgba(0,0,0,0.12);
          font-family: 'DM Sans', 'Segoe UI', sans-serif;
          animation: bcmModalIn 0.35s cubic-bezier(0.16,1,0.3,1) both;
          scrollbar-width: none;
        }
        .bcm-modal::-webkit-scrollbar { display: none; }
        @keyframes bcmModalIn {
          from { opacity: 0; transform: translateY(28px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Top gradient bar */
        .bcm-bar {
          height: 4px;
          background: linear-gradient(90deg, #0D4F4F, #E8A598);
          border-radius: 28px 28px 0 0;
        }

        /* Header */
        .bcm-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          padding: 24px 26px 0;
        }
        .bcm-header-left {}
        .bcm-eyebrow {
          font-size: 10.5px; font-weight: 700; letter-spacing: 1.5px;
          color: #0D4F4F; text-transform: uppercase; margin-bottom: 5px;
          display: flex; align-items: center; gap: 6px;
        }
        .bcm-eyebrow-dot { width: 4px; height: 4px; border-radius: 50%; background: #E8A598; }
        .bcm-title {
          font-family: 'Playfair Display', serif;
          font-size: 22px; font-weight: 900; color: #0D1B1B;
          line-height: 1.15; letter-spacing: -0.3px; margin: 0;
        }
        .bcm-title span { color: #E8A598; }
        .bcm-close {
          width: 34px; height: 34px; border-radius: 50%;
          border: 1.5px solid #E2EAF0; background: white;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; color: #9BAAB8; flex-shrink: 0; margin-top: 2px;
          transition: border-color 0.15s, color 0.15s;
        }
        .bcm-close:hover { border-color: #C0392B; color: #C0392B; }

        /* Balance row */
        .bcm-balance {
          display: flex; align-items: center; gap: 10px;
          margin: 16px 26px 0;
          background: rgba(13,79,79,0.05); border: 1.5px solid rgba(13,79,79,0.1);
          border-radius: 14px; padding: 12px 16px;
        }
        .bcm-balance-icon {
          width: 34px; height: 34px; border-radius: 9px; flex-shrink: 0;
          background: rgba(13,79,79,0.1);
          display: flex; align-items: center; justify-content: center; color: #0D4F4F;
        }
        .bcm-balance-label { font-size: 12px; color: #7A8FA6; font-weight: 500; margin-bottom: 1px; }
        .bcm-balance-value { font-size: 15px; font-weight: 800; color: #0D1B1B; }

        /* Deficit warning */
        .bcm-deficit {
          display: flex; align-items: center; gap: 8px;
          margin: 10px 26px 0;
          background: rgba(192,122,32,0.07); border: 1.5px solid rgba(192,122,32,0.22);
          border-radius: 12px; padding: 10px 14px;
          font-size: 12.5px; font-weight: 600; color: #92580A; line-height: 1.5;
        }
        .bcm-deficit-dot { width: 6px; height: 6px; border-radius: 50%; background: #C07A20; flex-shrink: 0; }

        /* Section label */
        .bcm-section-label {
          font-size: 11px; font-weight: 700; letter-spacing: 1.2px;
          color: #9BAAB8; text-transform: uppercase;
          padding: 20px 26px 10px;
        }

        /* Preset grid */
        .bcm-presets {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 10px; padding: 0 26px;
        }

        .bcm-preset {
          position: relative; border-radius: 16px; padding: 16px 14px;
          border: 1.5px solid #E2EAF0; background: white;
          cursor: pointer; text-align: left;
          transition: border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s;
        }
        .bcm-preset:hover {
          border-color: rgba(13,79,79,0.35);
          transform: translateY(-1px); box-shadow: 0 4px 12px rgba(13,79,79,0.1);
        }
        .bcm-preset.selected {
          border-color: #0D4F4F; background: rgba(13,79,79,0.04);
          box-shadow: 0 0 0 4px rgba(13,79,79,0.08);
        }
        .bcm-preset.popular {
          border-color: #E8A598;
        }
        .bcm-preset.popular.selected {
          border-color: #0D4F4F;
        }

        .bcm-preset-badge {
          position: absolute; top: -9px; right: 10px;
          font-size: 9.5px; font-weight: 800; letter-spacing: 0.5px;
          text-transform: uppercase; padding: 2px 8px; border-radius: 20px;
        }
        .bcm-preset-badge.popular  { background: #E8A598; color: white; }
        .bcm-preset-badge.best     { background: #0D4F4F; color: white; }

        .bcm-preset-credits {
          font-family: 'Playfair Display', serif;
          font-size: 26px; font-weight: 900; color: #0D1B1B;
          line-height: 1; margin-bottom: 2px;
        }
        .bcm-preset-clabel { font-size: 11px; font-weight: 600; color: #9BAAB8; margin-bottom: 8px; }
        .bcm-preset-price {
          font-size: 13px; font-weight: 700; color: #0D4F4F;
          background: rgba(13,79,79,0.08); border-radius: 8px; padding: 3px 8px;
          display: inline-block;
        }

        /* Check mark */
        .bcm-preset-check {
          position: absolute; top: 10px; right: 10px;
          width: 20px; height: 20px; border-radius: 50%;
          background: #0D4F4F; display: flex; align-items: center; justify-content: center;
          opacity: 0; transform: scale(0.6); transition: opacity 0.15s, transform 0.15s;
        }
        .bcm-preset.selected .bcm-preset-check { opacity: 1; transform: scale(1); }
        .bcm-preset-check::after {
          content: ''; width: 5px; height: 9px;
          border: 2px solid white; border-top: none; border-left: none;
          transform: rotate(45deg) translateY(-1px);
        }

        /* Custom amount */
        .bcm-custom-toggle {
          display: flex; align-items: center; justify-content: space-between;
          margin: 14px 26px 0; padding: 13px 16px;
          border: 1.5px solid #E2EAF0; border-radius: 14px; cursor: pointer;
          background: white; font-family: inherit;
          transition: border-color 0.15s, background 0.15s;
        }
        .bcm-custom-toggle:hover { border-color: rgba(13,79,79,0.3); background: rgba(13,79,79,0.02); }
        .bcm-custom-toggle.active { border-color: #0D4F4F; background: rgba(13,79,79,0.03); }
        .bcm-custom-toggle-label { font-size: 13.5px; font-weight: 600; color: #4A6072; }
        .bcm-custom-toggle-icon { color: #9BAAB8; transition: transform 0.2s; }
        .bcm-custom-toggle.active .bcm-custom-toggle-icon { transform: rotate(90deg); }

        /* Custom input */
        .bcm-custom-input-wrap {
          display: flex; align-items: center; gap: 10px;
          margin: 10px 26px 0; padding: 12px 14px;
          border: 1.5px solid #0D4F4F; border-radius: 14px;
          background: rgba(13,79,79,0.02);
          box-shadow: 0 0 0 4px rgba(13,79,79,0.06);
          animation: bcmSlideIn 0.2s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes bcmSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .bcm-stepper-btn {
          width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
          border: 1.5px solid #E2EAF0; background: white; cursor: pointer;
          display: flex; align-items: center; justify-content: center; color: #0D4F4F;
          transition: border-color 0.15s, background 0.15s;
        }
        .bcm-stepper-btn:hover { border-color: #0D4F4F; background: rgba(13,79,79,0.06); }
        .bcm-custom-input {
          flex: 1; text-align: center; border: none; outline: none; background: transparent;
          font-size: 20px; font-weight: 800; color: #0D1B1B;
          font-family: 'Playfair Display', serif;
        }
        .bcm-custom-unit { font-size: 12px; font-weight: 700; color: #9BAAB8; flex-shrink: 0; }

        /* Summary bar */
        .bcm-summary {
          margin: 18px 26px 0;
          background: linear-gradient(135deg, rgba(13,79,79,0.06), rgba(13,79,79,0.03));
          border: 1.5px solid rgba(13,79,79,0.14); border-radius: 16px;
          padding: 16px 18px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .bcm-summary-left {}
        .bcm-summary-getting { font-size: 12px; color: #7A8FA6; font-weight: 500; margin-bottom: 2px; }
        .bcm-summary-credits {
          font-family: 'Playfair Display', serif;
          font-size: 22px; font-weight: 900; color: #0D4F4F; line-height: 1;
        }
        .bcm-summary-credits span { font-size: 13px; font-weight: 600; color: #7A8FA6; margin-left: 4px; font-family: 'DM Sans', sans-serif; }
        .bcm-summary-right { text-align: right; }
        .bcm-summary-paying { font-size: 12px; color: #7A8FA6; font-weight: 500; margin-bottom: 2px; }
        .bcm-summary-amount {
          font-family: 'Playfair Display', serif;
          font-size: 22px; font-weight: 900; color: #0D1B1B; line-height: 1;
        }
        .bcm-summary-amount span { font-size: 13px; font-weight: 600; color: #7A8FA6; margin-left: 3px; font-family: 'DM Sans', sans-serif; }

        /* Divider */
        .bcm-divider { height: 1px; background: #F0F4F8; margin: 20px 26px 0; }

        /* Actions */
        .bcm-actions { display: flex; gap: 10px; padding: 16px 26px 26px; }

        .bcm-cancel {
          padding: 13px 18px; border-radius: 13px;
          border: 1.5px solid #E2EAF0; background: white;
          color: #4A6072; font-size: 14px; font-weight: 700; font-family: inherit;
          cursor: pointer; transition: border-color 0.15s, color 0.15s;
          white-space: nowrap;
        }
        .bcm-cancel:hover { border-color: #0D4F4F; color: #0D4F4F; }

        .bcm-pay {
          flex: 1; padding: 13px; border-radius: 13px; border: none;
          background: linear-gradient(135deg, #0D4F4F, #0A3D3D);
          color: white; font-size: 15px; font-weight: 700; font-family: inherit;
          cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px;
          box-shadow: 0 4px 14px rgba(13,79,79,0.35);
          transition: transform 0.15s, box-shadow 0.15s, opacity 0.2s;
          position: relative; overflow: hidden;
        }
        .bcm-pay::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.08), transparent);
          opacity: 0; transition: opacity 0.2s;
        }
        .bcm-pay:hover:not(:disabled)::after { opacity: 1; }
        .bcm-pay:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 22px rgba(13,79,79,0.42); }
        .bcm-pay:active:not(:disabled) { transform: translateY(0); }
        .bcm-pay:disabled { opacity: 0.55; cursor: not-allowed; }

        .bcm-spinner {
          width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white; border-radius: 50%;
          animation: bcmSpin 0.7s linear infinite; flex-shrink: 0;
        }
        @keyframes bcmSpin { to { transform: rotate(360deg); } }

        /* Rate note */
        .bcm-rate-note {
          text-align: center; font-size: 11.5px; color: #B0BEC8;
          padding: 0 26px 20px; margin-top: -6px; line-height: 1.5;
        }
        .bcm-rate-note strong { color: #7A8FA6; }

        @media (max-width: 460px) {
          .bcm-presets { grid-template-columns: 1fr 1fr; gap: 8px; }
          .bcm-preset-credits { font-size: 22px; }
        }
      `}</style>

      <div className="bcm-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bcm-modal">
          <div className="bcm-bar" />

          {/* Header */}
          <div className="bcm-header">
            <div className="bcm-header-left">
              <div className="bcm-eyebrow"><div className="bcm-eyebrow-dot" />Credits</div>
              <h2 className="bcm-title">Purchase <span>Credits</span></h2>
            </div>
            <button className="bcm-close" onClick={onClose}><X size={16} /></button>
          </div>

          {/* Current balance */}
          <div className="bcm-balance">
            <div className="bcm-balance-icon"><Coins size={16} /></div>
            <div>
              <div className="bcm-balance-label">Current balance</div>
              <div className="bcm-balance-value">{currentCredits.toLocaleString()} credits</div>
            </div>
          </div>

          {/* Deficit warning */}
          {isDeficit && (
            <div className="bcm-deficit">
              <div className="bcm-deficit-dot" />
              You need {deficit} more credit{deficit !== 1 ? 's' : ''} to proceed. Select a package below.
            </div>
          )}

          {/* Preset grid */}
          <div className="bcm-section-label">Choose a package</div>
          <div className="bcm-presets">
            {PRESETS.map(preset => (
              <button
                key={preset.credits}
                className={`bcm-preset${selectedCredits === preset.credits && !customMode ? ' selected' : ''}${preset.popular ? ' popular' : ''}`}
                onClick={() => { setSelectedCredits(preset.credits); setCustomMode(false); }}
              >
                {preset.badge && (
                  <span className={`bcm-preset-badge ${preset.badge === 'Popular' ? 'popular' : 'best'}`}>
                    {preset.badge}
                  </span>
                )}
                <div className="bcm-preset-check" />
                <div className="bcm-preset-credits">{preset.credits}</div>
                <div className="bcm-preset-clabel">credits</div>
                <div className="bcm-preset-price">{(preset.credits * CREDIT_COST).toLocaleString()} TZS</div>
              </button>
            ))}
          </div>

          {/* Custom amount toggle */}
          <button
            className={`bcm-custom-toggle${customMode ? ' active' : ''}`}
            onClick={() => setCustomMode(m => !m)}
          >
            <span className="bcm-custom-toggle-label">Custom amount</span>
            <ChevronRight size={16} className="bcm-custom-toggle-icon" />
          </button>

          {/* Custom input */}
          {customMode && (
            <div className="bcm-custom-input-wrap">
              <button
                className="bcm-stepper-btn"
                onClick={() => setCustomCredits(c => String(Math.max(1, (parseInt(c || '0') || 0) - 1)))}
              >
                <Minus size={14} />
              </button>
              <input
                type="number"
                className="bcm-custom-input"
                value={customCredits}
                onChange={e => setCustomCredits(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                min="1"
              />
              <span className="bcm-custom-unit">credits</span>
              <button
                className="bcm-stepper-btn"
                onClick={() => setCustomCredits(c => String((parseInt(c || '0') || 0) + 1))}
              >
                <Plus size={14} />
              </button>
            </div>
          )}

          {/* Summary */}
          <div className="bcm-summary">
            <div className="bcm-summary-left">
              <div className="bcm-summary-getting">You're getting</div>
              <div className="bcm-summary-credits">
                {activeCredits > 0 ? activeCredits.toLocaleString() : '—'}
                <span>credits</span>
              </div>
            </div>
            <div className="bcm-summary-right">
              <div className="bcm-summary-paying">Total</div>
              <div className="bcm-summary-amount">
                {activeCredits > 0 ? totalTZS.toLocaleString() : '—'}
                <span>TZS</span>
              </div>
            </div>
          </div>

          <div className="bcm-divider" />

          {/* Actions */}
          <div className="bcm-actions">
            <button className="bcm-cancel" onClick={onClose}>Cancel</button>
            <button
              className="bcm-pay"
              onClick={handlePurchase}
              disabled={loading || activeCredits < 1}
            >
              {loading
                ? <><div className="bcm-spinner" /> Processing…</>
                : <><Sparkles size={15} /> Pay {activeCredits > 0 ? `${totalTZS.toLocaleString()} TZS` : 'Now'}</>
              }
            </button>
          </div>

          <p className="bcm-rate-note">
            1 credit = <strong>300 TZS</strong> · Secure payment via ClickPesa
          </p>
        </div>
      </div>
    </>,
    document.body
  );
}