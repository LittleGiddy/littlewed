'use client';
import { useEffect, useState } from 'react';
import { CreditCard, Zap, TrendingUp } from 'lucide-react';

export default function BillingPage() {
  const [balance, setBalance] = useState(0);
  const [usage, setUsage] = useState<any[]>([]);
  const [amount, setAmount] = useState(10000);
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    const res = await fetch('/api/tenant/billing');
    const data = await res.json();
    setBalance(data.tenant?.creditBalance || 0);
    setUsage(data.usage || []);
  };

  useEffect(() => {
    loadData();
  }, []);

const buyCredits = async () => {
  setLoading(true);
  const res = await fetch('/api/tenant/purchase-credits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount }),
  });
  const { checkoutUrl } = await res.json();
  if (checkoutUrl) window.location.href = checkoutUrl;
  setLoading(false);
};

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Billing & Credits</h1>
      <p className="text-gray-500 mb-6">Purchase credits to send invitations. Each WhatsApp message costs 50 TZS, SMS costs 25 TZS.</p>

      <div className="bg-white rounded-2xl shadow p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-100 rounded-xl"><Zap className="w-6 h-6 text-yellow-600" /></div>
          <h2 className="text-xl font-semibold">Credit Balance</h2>
        </div>
        <p className="text-4xl font-bold text-indigo-600">{balance} TZS</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {[10000, 25000, 50000, 100000].map(amt => (
            <button
              key={amt}
              onClick={() => setAmount(amt)}
              className={`px-4 py-2 rounded-xl border ${amount === amt ? 'bg-indigo-100 border-indigo-600 text-indigo-700' : 'border-gray-300'}`}
            >
              {amt.toLocaleString()} TZS
            </button>
          ))}
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(Number(e.target.value))}
            className="border rounded-xl px-4 py-2 w-32"
            placeholder="Custom"
          />
          <button
            onClick={buyCredits}
            disabled={loading}
            className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold flex items-center gap-2"
          >
            <CreditCard className="w-5 h-5" />
            {loading ? 'Processing...' : 'Buy Credits'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 rounded-xl"><TrendingUp className="w-6 h-6 text-blue-600" /></div>
          <h2 className="text-xl font-semibold">Recent Usage</h2>
        </div>
        {usage.length === 0 ? (
          <p className="text-gray-500">No usage yet. Send some invitations to see records here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr><th className="text-left py-2">Date</th><th className="text-left">Event</th><th className="text-left">Channel</th><th className="text-right">Cost (TZS)</th></tr>
              </thead>
              <tbody>
                {usage.map(u => (
                  <tr key={u.id} className="border-b">
                    <td className="py-2">{new Date(u.createdAt).toLocaleDateString()}</td>
                    <td>{u.event?.name || '—'}</td>
                    <td>{u.channel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</td>
                    <td className="text-right">{u.cost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}