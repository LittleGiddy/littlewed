'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function SendPage() {
  const { eventId } = useParams();
  const [guests, setGuests] = useState([]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/events/${eventId}/guests`)
      .then(res => res.json())
      .then(data => {
        setGuests(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [eventId]);

  const broadcast = async () => {
    setSending(true);
    try {
      const res = await fetch('/api/invitations/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  if (loading) return <div className="p-4">Loading guests...</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Send Invitations</h1>
      <button
        onClick={broadcast}
        disabled={sending}
        className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-semibold shadow-md hover:bg-indigo-700 disabled:opacity-50"
      >
        {sending ? 'Broadcasting...' : 'Broadcast All'}
      </button>

      {results.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">Results</h2>
          <div className="space-y-2">
            {results.map((r, idx) => (
              <div key={idx} className="p-2 bg-gray-50 rounded">
                {r.name}: {r.success ? '✅ Sent' : `❌ ${r.error || 'Failed'}`}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold mb-2">Guests</h2>
        <div className="space-y-2">
          {guests.map((guest: any) => (
            <div key={guest.id} className="p-3 bg-white rounded shadow-sm border">
              <p><strong>{guest.name}</strong> – {guest.phone}</p>
              <p className="text-sm text-gray-500">Channel: {guest.routingChannel || 'sms'}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}