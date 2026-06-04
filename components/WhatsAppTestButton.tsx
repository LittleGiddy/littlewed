'use client';

import { useState } from 'react';

export default function WhatsAppTestButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');

  const sendTest = async () => {
    setLoading(true);
    setResult('');
    try {
      const res = await fetch('/api/whatsapp/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toNumber: '+255769999902', // replace with your personal WhatsApp number
          message: 'Hello from Little Wed! Your WhatsApp integration is working.',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult('✅ Message sent! Check your WhatsApp.');
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
        onClick={sendTest}
        disabled={loading}
        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
      >
        {loading ? 'Sending...' : 'Send WhatsApp Test'}
      </button>
      {result && <p className="mt-2 text-sm">{result}</p>}
    </div>
  );
}