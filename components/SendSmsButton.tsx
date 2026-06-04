// components/SendSmsButton.tsx
'use client';

import { useState } from 'react';

export default function SendSmsButton({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSend = async () => {
    if (!confirm('Send SMS codes to all guests without codes? This may take a few seconds.')) return;

    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/send-sms-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });

      const data = await res.json();
      if (res.ok) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        setMessage(`✅ Sent codes to ${successCount} guests.`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setMessage(`❌ Error: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      setMessage('❌ Network error. Check console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleSend}
        disabled={loading}
        className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send SMS codes'}
      </button>
      {message && (
        <p className={`text-xs mt-1 ${message.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
          {message}
        </p>
      )}
    </div>
  );
}