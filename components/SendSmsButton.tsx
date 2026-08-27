// components/SendSmsButton.tsx
'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { confirmToast } from '@/lib/confirmToast';

export default function SendSmsButton({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const ok = await confirmToast({
      title: 'Send SMS codes',
      message: 'Send SMS codes to all guests without codes? This may take a few seconds.',
      confirmText: 'Send',
    });
    if (!ok) return;

    setLoading(true);

    try {
      const res = await fetch('/api/send-sms-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });

      const data = await res.json();
      if (res.ok) {
        const successCount = data.results?.filter((r: any) => r.success).length || 0;
        toast.success(`Sent codes to ${successCount} guests.`);
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error(data.error || 'Failed to send SMS codes');
      }
    } catch {
      toast.error('Network error. Check console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSend}
      disabled={loading}
      className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
    >
      {loading ? 'Sending...' : 'Send SMS codes'}
    </button>
  );
}