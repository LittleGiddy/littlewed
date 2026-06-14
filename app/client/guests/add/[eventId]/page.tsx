'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AddGuestPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, eventId }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/client/events/${eventId}`);
      } else {
        setError(data.error || 'Failed to add guest');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-2xl shadow-md">
      <Link href={`/client/events/${eventId}`} className="text-sm text-indigo-600 mb-4 inline-block">← Back to Event</Link>
      <h1 className="text-2xl font-bold mb-4">Add Guest</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Full Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full p-2 border rounded-xl"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone Number</label>
          <input
            type="tel"
            placeholder="e.g., +255712345678"
            required
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full p-2 border rounded-xl"
          />
          <p className="text-xs text-gray-500 mt-1">Include country code with + (e.g., +255...)</p>
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 text-white py-2 rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {loading ? 'Adding...' : 'Add Guest'}
        </button>
      </form>
    </div>
  );
}