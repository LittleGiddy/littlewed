'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface Guest {
  id: string;
  name: string;
  phone: string;
  routingChannel: string;
  invitationCard: string | null;
  smsCode: string | null;
}

interface Result {
  guestId: string;
  success: boolean;
  error?: string;
}

export default function SendInvitationsPage() {
  const { eventId } = useParams();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/events/${eventId}/guests`, { credentials: 'include' }) // ✅ add this
      .then(res => res.json())
      .then(data => {
        setGuests(data);
        setLoading(false);
      });
  }, [eventId]);

  const broadcast = async () => {
    setSending(true);
    const res = await fetch('/api/invitations/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // ✅ add this — sends session cookie
      body: JSON.stringify({ eventId }),
    });
    const data = await res.json();
    if (data.results) {
      setResults(data.results);
    }
    setSending(false);
  };

  const getGuestStatus = (guest: Guest) => {
    const r = results.find(r => r.guestId === guest.id);
    return r ? (r.success ? '✅ Sent' : `❌ ${r.error || 'Failed'}`) : (guest.invitationCard ? 'QR ready' : 'No QR');
  };

  if (loading) return <div className="p-4 text-center">Loading guests...</div>;

  return (
    <div className="max-w-2xl mx-auto p-4 pb-20">
      <Link href={`/client/events/${eventId}`} className="text-indigo-600 text-sm">← Back to Event</Link>
      <h1 className="text-2xl font-bold mt-4 mb-2">Send Invitations</h1>
      <p className="text-gray-500 mb-6">WhatsApp guests receive a QR card, SMS guests receive a numeric code.</p>

      <button
        onClick={broadcast}
        disabled={sending}
        className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold shadow-md hover:bg-green-700 disabled:opacity-50 mb-6"
      >
        {sending ? 'Broadcasting...' : '📱 Broadcast All'}
      </button>

      <div className="space-y-3">
        {guests.map(guest => (
          <div key={guest.id} className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
            <div>
              <p className="font-medium">{guest.name}</p>
              <p className="text-sm text-gray-500">{guest.phone}</p>
              <p className="text-xs text-gray-400">{guest.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS'}</p>
            </div>
            <div className="text-right">
              <span className="text-sm">{getGuestStatus(guest)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}