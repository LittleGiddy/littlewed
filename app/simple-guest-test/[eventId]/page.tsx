'use client';

import { useEffect, useState } from 'react';

export default function SimpleGuestTest({ params }: { params: Promise<{ eventId: string }> }) {
  const [eventId, setEventId] = useState('');
  const [guests, setGuests] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    params.then(async ({ eventId }) => {
      setEventId(eventId);
      try {
        const res = await fetch(`/api/events/${eventId}/guests`);
        const data = await res.json();
        console.log('Guests from API:', data);
        setGuests(data);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(String(err));
      }
    });
  }, [params]);

  return (
    <div className="p-8">
      <h1>Event ID: {eventId}</h1>
      <h2>Guests:</h2>
      <pre>{JSON.stringify(guests, null, 2)}</pre>
      {error && <p style={{color: 'red'}}>Error: {error}</p>}
    </div>
  );
}