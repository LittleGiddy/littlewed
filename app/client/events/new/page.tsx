'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewEventPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', date: '', venue: '', address: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      router.push('/client/events');
    } else {
      const data = await res.json();
      alert(data.error || 'Failed to create event');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Event</h1>
      <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-md p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Event Name</label>
          <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full p-3 border rounded-xl" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Date & Time</label>
          <input type="datetime-local" required value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full p-3 border rounded-xl" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Venue Name</label>
          <input type="text" required value={form.venue} onChange={e => setForm({...form, venue: e.target.value})} className="w-full p-3 border rounded-xl" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea rows={2} required value={form.address} onChange={e => setForm({...form, address: e.target.value})} className="w-full p-3 border rounded-xl" />
        </div>
        <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold shadow-md hover:shadow-lg transition">
          {loading ? 'Creating...' : 'Create Event'}
        </button>
      </form>
    </div>
  );
}