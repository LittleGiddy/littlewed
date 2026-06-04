'use client';

import { useState } from 'react';

export default function WhatsAppInvitationTest() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const sendInvitation = async () => {
    setLoading(true);
    setResult('');
    try {
      const res = await fetch('/api/whatsapp/send-invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toNumber: '+255769999902', // your personal number
          message: "You're invited to Little Wed event! Scan the QR code below.",
          imageUrl: 'https://picsum.photos/500/500', // temporary test image
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult('✅ Invitation image sent! Check your WhatsApp.');
      } else {
        setResult(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      setResult('❌ Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={sendInvitation}
        disabled={loading}
        className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700"
      >
        {loading ? 'Sending...' : 'Send Invitation Card (Test Image)'}
      </button>
      {result && <p className="mt-2 text-sm">{result}</p>}
    </div>
  );
}