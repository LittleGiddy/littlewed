'use client';
import { useEffect, useState } from  'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

export default function StaffDashboard() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);  // ensure array
  const [selectedEventId, setSelectedEventId] = useState('');
  const [guests, setGuests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login');
    if (session?.user?.role !== 'STAFF') router.push('/login');
  }, [session, status, router]);

  useEffect(() => {
    if (session && session.user?.role === 'STAFF') {
      fetch('/api/events')
        .then(res => {
          if (!res.ok) throw new Error('Failed to fetch events');
          return res.json();
        })
        .then(data => {
          setEvents(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setEvents([]);
          setLoading(false);
        });
    }
  }, [session]);

  const loadGuests = async (eventId: string) => {
    setSelectedEventId(eventId);
    const res = await fetch(`/api/events/${eventId}/guests`);
    const data = await res.json();
    setGuests(Array.isArray(data) ? data : []);
  };

  const toggleCheckin = async (guestId: string, currentStatus: boolean) => {
    const res = await fetch(`/api/guests/${guestId}/checkin`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checkedIn: !currentStatus }),
    });
    if (res.ok) loadGuests(selectedEventId);
  };

  if (status === 'loading' || loading) return <div className="p-4">Loading...</div>;
  if (!session || session.user?.role !== 'STAFF') return null;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Staff Dashboard – Check‑in Guests</h1>
      <div className="mb-6">
        <label className="block text-sm font-medium mb-1">Select Event</label>
        <select
          className="w-full p-2 border rounded-xl"
          value={selectedEventId}
          onChange={e => loadGuests(e.target.value)}
        >
          <option value="">-- Choose event --</option>
          {events.map((e: any) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>
      {selectedEventId && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr><th className="p-3">Name</th><th>Phone</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {guests.map((g: any) => (
                <tr key={g.id} className="border-t">
                  <td className="p-3">{g.name}</td>
                  <td>{g.phone}</td>
                  <td>{g.checkedIn ? '✅ Checked in' : '⭕ Not checked in'}</td>
                  <td>
                    <button
                      onClick={() => toggleCheckin(g.id, g.checkedIn)}
                      className="px-3 py-1 rounded text-sm bg-indigo-600 text-white"
                    >
                      {g.checkedIn ? 'Undo' : 'Check In'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}