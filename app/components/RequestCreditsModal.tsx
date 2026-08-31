'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Coins, Minus, Plus, Send, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const CREDIT_COST_TZS = 500;

const PRESETS = [
  { credits: 10, label: '10', badge: null },
  { credits: 25, label: '25', badge: 'Popular' },
  { credits: 50, label: '50', badge: 'Best value' },
  { credits: 100, label: '100', badge: null },
];

interface RequestCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRequestSent?: () => void;
  hasPending?: boolean;
  requiredCredits?: number;
}

export default function RequestCreditsModal({
  isOpen,
  onClose,
  onRequestSent,
  hasPending = false,
  requiredCredits = 0,
}: RequestCreditsModalProps) {
  const [selectedCredits, setSelectedCredits] = useState(25);
  const [customMode, setCustomMode] = useState(false);
  const [customCredits, setCustomCredits] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  // Pre-select an amount that covers the shortfall, if one is provided.
  // Uses the render-time derived-state pattern (no effect) to adjust state
  // when requiredCredits changes.
  const [prevRequired, setPrevRequired] = useState<number>(requiredCredits);
  if (requiredCredits !== prevRequired && requiredCredits > 0) {
    setPrevRequired(requiredCredits);
    const preset = PRESETS.find((p) => p.credits >= requiredCredits);
    if (preset) {
      setSelectedCredits(preset.credits);
      setCustomMode(false);
    } else {
      setSelectedCredits(25);
      setCustomMode(true);
      setCustomCredits(String(requiredCredits));
    }
  }

  const activeCredits = customMode
    ? Math.max(1, parseInt(customCredits || '0', 10) || 0)
    : selectedCredits;
  const totalTZS = activeCredits * CREDIT_COST_TZS;

  const handleRequest = async () => {
    if (hasPending) {
      toast.error('You already have a pending request');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/credits/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ credits: activeCredits, reason: reason || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Credit request sent to admin! Contact +255702529514 for assistance.');
        onRequestSent?.();
        onClose();
      } else {
        toast.error(data.error || 'Failed to send request');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[24px] w-full max-w-[420px] max-h-[85vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0D4B4B]/5 flex items-center justify-center text-[#0D4B4B]">
              <Coins size={20} />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-gray-900">Request Credits</h2>
              <p className="text-xs text-gray-400">1 credit = {CREDIT_COST_TZS.toLocaleString()} TZS</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6">
          {hasPending && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-5">
              <Clock size={18} className="text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-amber-800">Request pending</p>
                <p className="text-xs text-amber-600 mt-0.5">You already have a credit request being reviewed by the admin. Need it sooner? WhatsApp +255702529514.</p>
              </div>
            </div>
          )}

          {requiredCredits > 0 && (
            <div className="flex items-start gap-2.5 bg-[#0D4B4B]/[0.06] border border-[#0D4B4B]/15 rounded-2xl p-4 mb-5">
              <AlertCircle size={18} className="text-[#C07A20] shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-[#0A3939]">You need {requiredCredits} more credit{requiredCredits !== 1 ? 's' : ''}</p>
                <p className="text-xs text-[#0D4B4B]/80 mt-0.5">
                  The amount below is pre-selected to cover your shortfall. Request it to continue importing.
                </p>
              </div>
            </div>
          )}

          {/* Preset Grid */}
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Select amount</p>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            {PRESETS.map((p) => {
              const isSelected = selectedCredits === p.credits && !customMode;
              return (
                <button
                  key={p.credits}
                  onClick={() => { setSelectedCredits(p.credits); setCustomMode(false); }}
                  disabled={hasPending}
                  className={`relative rounded-2xl p-4 border-[1.5px] bg-white cursor-pointer text-center transition-all hover:-translate-y-0.5 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSelected
                      ? 'border-[#0D4B4B] bg-[#0D4B4B]/[0.04] shadow-[0_0_0_4px_rgba(13,75,75,0.08)]'
                      : 'border-gray-200'
                  }`}
                >
                  {p.badge && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[8.5px] font-extrabold tracking-wider uppercase px-2 py-0.5 rounded-full whitespace-nowrap bg-[#FF6B5C] text-white">
                      {p.badge}
                    </span>
                  )}
                  <div className="font-serif text-[22px] font-black text-gray-900 leading-none">{p.credits}</div>
                  <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5 mb-2">credits</div>
                  <div className="text-[11.5px] font-bold text-[#0D4B4B]">{(p.credits * CREDIT_COST_TZS).toLocaleString()} TZS</div>
                </button>
              );
            })}
          </div>

          {/* Custom Toggle */}
          <button
            onClick={() => setCustomMode((m) => !m)}
            disabled={hasPending}
            className={`flex items-center justify-between w-full px-4 py-3 border-[1.5px] rounded-2xl cursor-pointer bg-white transition-all mb-3 disabled:opacity-50 ${
              customMode ? 'border-[#0D4B4B] bg-[#0D4B4B]/[0.02]' : 'border-gray-200 hover:border-[#0D4B4B]/30'
            }`}
          >
            <span className="text-[13.5px] font-semibold text-gray-500">Custom amount</span>
            <svg className={`w-4 h-4 text-gray-400 transition-transform ${customMode ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>

          {/* Custom Input */}
          {customMode && (
            <div className="flex items-center gap-2.5 px-3.5 py-3 border-[1.5px] border-[#0D4B4B] rounded-2xl bg-[#0D4B4B]/[0.02] mb-3 shadow-[0_0_0_4px_rgba(13,75,75,0.06)]">
              <button
                onClick={() => setCustomCredits((c) => String(Math.max(1, (parseInt(c || '0') || 0) - 1)))}
                className="w-[30px] h-[30px] rounded-lg border border-gray-200 bg-white cursor-pointer flex items-center justify-center text-[#0D4B4B]"
              >
                <Minus size={13} />
              </button>
              <input
                type="number"
                className="flex-1 text-center border-none outline-none bg-transparent text-xl font-black text-gray-900 font-serif"
                value={customCredits}
                onChange={(e) => setCustomCredits(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="0"
                min="1"
              />
              <span className="text-xs font-bold text-gray-400">credits</span>
              <button
                onClick={() => setCustomCredits((c) => String((parseInt(c || '0') || 0) + 1))}
                className="w-[30px] h-[30px] rounded-lg border border-gray-200 bg-white cursor-pointer flex items-center justify-center text-[#0D4B4B]"
              >
                <Plus size={13} />
              </button>
            </div>
          )}

          {/* Summary */}
          <div className="flex items-center gap-3 bg-[#0D4B4B]/[0.06] border border-[#0D4B4B]/10 rounded-2xl px-4 py-3 mb-4">
            <div className="flex-1">
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider m-0">Credits</p>
              <div className="font-serif text-xl font-black text-[#0D4B4B] leading-tight">{activeCredits}</div>
            </div>
            <div className="w-px h-8 bg-[#0D4B4B]/20" />
            <div className="flex-1">
              <p className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider m-0">Total cost</p>
              <div className="font-serif text-xl font-black text-gray-900 leading-tight">{totalTZS.toLocaleString()} TZS</div>
            </div>
          </div>

          {/* Reason */}
          <div className="mb-4">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1.5">Reason (optional)</label>
            <input
              type="text"
              className="w-full px-4 py-3 border-[1.5px] border-gray-200 rounded-2xl text-sm font-medium text-gray-700 outline-none focus:border-[#0D4B4B] transition-colors"
              placeholder="e.g. Need credits for upcoming wedding..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Send Request Button */}
          <button
            onClick={handleRequest}
            disabled={loading || hasPending || activeCredits < 1}
            className="w-full flex items-center justify-center gap-2 px-7 py-3.5 border-none rounded-2xl bg-gradient-to-br from-[#0D4B4B] to-[#0A3939] text-white text-[15px] font-bold cursor-pointer shadow-md shadow-[#0D4B4B]/35 transition-all hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-55 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send size={15} /> Send Request to Admin
              </>
            )}
          </button>

          <p className="text-[11.5px] text-gray-400 mt-3 text-center leading-relaxed">
            Admin will review and approve your request. Credits are granted at <strong className="text-gray-500">1 credit = {CREDIT_COST_TZS.toLocaleString()} TZS</strong>. For assistance, contact admin at <strong className="text-gray-500">+255702529514</strong>.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
