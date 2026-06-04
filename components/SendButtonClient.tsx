'use client';

import { useState } from 'react';

export default function SendButton({
  guestId,
  eventId,
}: {
  guestId: string;
  eventId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleSend = async () => {
    console.log('Send button clicked');
    setLoading(true);
    setStatus('Sending...');
    try {
      const res = await fetch('/api/invitations/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, eventId }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('✅ Sent');
      } else {
        setStatus(`❌ ${data.error || 'Failed'}`);
      }
    } catch (err) {
      setStatus('❌ Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleSend}
        disabled={loading}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Send WhatsApp'}
      </button>
      {status && <p className="text-xs mt-1">{status}</p>}
    </div>
  );
}