'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

export default function SendPage() {
  const { eventId } = useParams();
  const [guests, setGuests] = useState([]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState([]);
  const [eventName, setEventName] = useState('');

  useEffect(() => {
    if (eventId) {
      fetch(`/api/events/${eventId}/guests`)
        .then(res => res.json())
        .then(data => setGuests(data));
      fetch(`/api/events/${eventId}`)
        .then(res => res.json())
        .then(data => setEventName(data.name));
    }
  }, [eventId]);

  const broadcast = async () => {
    setSending(true);
    const res = await fetch('/api/invitations/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId }),
    });
    const data = await res.json();
    setResults(data.results || []);
    setSending(false);
  };

  const getGuestStatus = (guest) => {
    const r = results.find(r => r.guestId === guest.id);
    return r ? (r.success ? '✅ Sent' : `❌ ${r.error || 'Failed'}`) : (guest.invitationCard ? 'QR ready' : 'No QR');
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <Link href={`/client/events/${eventId}`} className="text-indigo-600 hover:underline">← Back to Event</Link>
      <h1 className="text-2xl font-bold mt-4">Send Invitations – {eventName}</h1>
      <p className="text-gray-600 mb-4">WhatsApp guests receive the QR image; SMS guests receive a 6‑digit code.</p>
      <button
        onClick={broadcast}
        disabled={sending}
        className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold disabled:opacity-50"
      >
        {sending ? 'Broadcasting...' : 'Broadcast All'}
      </button>
      <div className="mt-6 space-y-2">
        {guests.map((guest) => (
          <div key={guest.id} className="bg-white p-3 rounded shadow flex justify-between items-center">
            <div>
              <p className="font-medium">{guest.name}</p>
              <p className="text-sm text-gray-500">{guest.phone}</p>
              <p className="text-xs text-gray-400">{guest.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</p>
            </div>
            <div className="text-sm">{getGuestStatus(guest)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}