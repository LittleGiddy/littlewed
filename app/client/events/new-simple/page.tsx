'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NewEventSimple() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', date: '', venue: '', address: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.push('/client/events');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create event');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Link
        href="/client/dashboard"
        className="inline-flex items-center gap-1 text-sm text-indigo-600 mb-4 hover:underline"
      >
        ← Back to Dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-2">Create New Event</h1>
      <p className="text-gray-500 mb-6">Quick Mode – no payment required.</p>
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-md p-6 space-y-5">
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-xl text-sm">
            {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">Event Name</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date & Time</label>
          <input
            type="datetime-local"
            required
            value={form.date}
            onChange={e => setForm({ ...form, date: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Venue Name</label>
          <input
            type="text"
            required
            value={form.venue}
            onChange={e => setForm({ ...form, venue: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea
            rows={2}
            required
            value={form.address}
            onChange={e => setForm({ ...form, address: e.target.value })}
            className="w-full p-3 border border-gray-200 rounded-xl"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-md hover:shadow-lg transition disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create Event'}
        </button>
      </form>
    </div>
  );
}