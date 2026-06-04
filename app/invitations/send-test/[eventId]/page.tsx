'use client';

import { useEffect, useState } from 'react';

interface Guest {
  id: string;
  name: string;
  phone: string;
  invitationCard: string | null;
}

export default function SendTestPage({ params }: { params: Promise<{ eventId: string }> }) {
  const [eventId, setEventId] = useState('');
  const [guests, setGuests] = useState<Guest[]>([]);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    params.then(async ({ eventId }) => {
      console.log('Event ID resolved:', eventId);
      setEventId(eventId);
      console.log('Fetching guests from /api/events/' + eventId + '/guests');
      const res = await fetch(`/api/events/${eventId}/guests`);
      console.log('Response status:', res.status);
      const data = await res.json();
      console.log('Guests data:', data);
      setGuests(data);
    });
  }, [params]);

  const sendToGuest = async (guest: Guest) => {
    setResults(prev => ({ ...prev, [guest.id]: 'sending...' }));
    try {
      const res = await fetch('/api/invitations/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId: guest.id, eventId }),
      });
      const data = await res.json();
      if (res.ok) {
        setResults(prev => ({ ...prev, [guest.id]: '✅ Sent' }));
      } else {
        setResults(prev => ({ ...prev, [guest.id]: `❌ ${data.error || 'Unknown error'}` }));
      }
    } catch (err) {
      setResults(prev => ({ ...prev, [guest.id]: '❌ Network error' }));
    }
  };

  const sendBulkWhatsApp = async () => {
    const eligible = guests.filter(g => g.phone && g.invitationCard);
    if (eligible.length === 0) {
      alert('No guests with both phone number and invitation card.');
      return;
    }
    setSending(true);
    for (const guest of eligible) {
      await sendToGuest(guest);
      await new Promise(r => setTimeout(r, 500));
    }
    setSending(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-gray-900">Send Invitations</h1>
          <p className="text-gray-600 mt-2">(Test Mode – No Login Required)</p>
        </div>

        <div className="flex gap-4 mb-8">
          <button
            onClick={sendBulkWhatsApp}
            disabled={sending}
            className="flex-1 bg-gradient-to-r from-green-600 to-teal-600 text-white py-3 rounded-xl font-semibold shadow-lg hover:shadow-xl transition disabled:opacity-50"
          >
            {sending ? 'Sending...' : '📱 Send All via WhatsApp'}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-white border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">Guests</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {guests.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-500">
                No guests found. Create guests and generate QR cards first.
              </div>
            )}
            {guests.map(guest => (
              <div key={guest.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50">
                <div>
                  <p className="font-medium text-gray-800">{guest.name}</p>
                  <p className="text-sm text-gray-500">{guest.phone || 'No phone'}</p>
                  {guest.invitationCard ? (
                    <span className="text-xs text-green-600">✓ QR ready</span>
                  ) : (
                    <span className="text-xs text-amber-600">⚠ No QR</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {results[guest.id] && (
                    <span className="text-sm">{results[guest.id]}</span>
                  )}
                  <button
                    onClick={() => sendToGuest(guest)}
                    disabled={!guest.phone || !guest.invitationCard}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Send
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}