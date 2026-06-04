'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { QrCode, KeyRound } from 'lucide-react';

export default function CheckInPage() {
  const searchParams = useSearchParams();
  const eventId = searchParams.get('event');
  const [mode, setMode] = useState<'qr' | 'code'>('qr');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    setLoading(true);
    const res = await fetch('/api/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ smsCode: code }),
    });
    const data = await res.json();
    if (res.ok) setMessage(`✅ Checked in: ${data.guest.name}`);
    else setMessage(`❌ ${data.error}`);
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Check‑in</h1>
      {eventId && <p className="text-sm text-gray-500 mb-4">Event ID: {eventId}</p>}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setMode('qr')} className={`px-3 py-1 rounded ${mode === 'qr' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>QR Code</button>
        <button onClick={() => setMode('code')} className={`px-3 py-1 rounded ${mode === 'code' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}>SMS Code</button>
      </div>
      {mode === 'code' && (
        <div>
          <input type="text" placeholder="Enter 6-digit code" value={code} onChange={e => setCode(e.target.value)} className="w-full p-2 border rounded mb-2" />
          <button onClick={handleCheckIn} disabled={loading} className="bg-green-600 text-white px-4 py-2 rounded">Check In</button>
        </div>
      )}
      {mode === 'qr' && (
        <div className="text-center text-gray-500">
          <QrCode className="w-24 h-24 mx-auto mb-2" />
          <p>Use camera to scan QR</p>
          <p className="text-xs">(Implementation requires device camera)</p>
        </div>
      )}
      {message && <div className="mt-4 p-2 bg-gray-100 rounded">{message}</div>}
    </div>
  );
}