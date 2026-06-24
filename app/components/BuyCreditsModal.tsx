'use client';
import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCredits?: number;
  requiredCredits?: number;
  returnUrl?: string;
}

const PRESET_AMOUNTS = [300, 600, 1000, 3000];

export default function BuyCreditsModal({
  isOpen,
  onClose,
  currentCredits = 0,
  requiredCredits = 0,
  returnUrl = '/client/dashboard',
}: BuyCreditsModalProps) {
  const initialAmount = requiredCredits > 0 && currentCredits !== undefined
    ? Math.max(300, (requiredCredits - currentCredits) * 300)
    : 300;

  const [amount, setAmount] = useState(initialAmount);
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    if (amount < 300) {
      toast.error('Minimum purchase is 300 TZS');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/tenant/purchase-credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, returnUrl }),
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
          <X size={20} />
        </button>
        <h2 className="font-serif text-xl font-bold text-gray-800 mb-2">Purchase Credits</h2>
        <p className="text-gray-600 text-sm mb-4">
          Each credit costs <span className="font-bold">300 TZS</span> and represents one guest slot.
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Current balance: <span className="font-bold text-[#0D4F4F]">{currentCredits} credits</span>
          {requiredCredits > 0 && currentCredits < requiredCredits && (
            <span className="block text-amber-600">You need {requiredCredits - currentCredits} more credits</span>
          )}
        </p>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Amount (TZS)</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_AMOUNTS.map((a) => (
              <button
                key={a}
                onClick={() => setAmount(a)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                  amount === a
                    ? 'bg-[#0D4F4F] text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {a.toLocaleString()} TZS
              </button>
            ))}
          </div>
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            min="300"
            step="100"
            className="w-full p-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4F4F]/20 focus:border-[#0D4F4F]"
            placeholder="Custom amount"
          />
          <p className="text-xs text-gray-400 mt-1">You'll get {Math.floor(amount / 300)} credits</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 rounded-xl py-2 font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handlePurchase}
            disabled={loading || amount < 300}
            className="flex-1 bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white rounded-xl py-2 font-bold shadow-md hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : 'Pay Now'}
          </button>
        </div>
      </div>
    </div>
  );
}