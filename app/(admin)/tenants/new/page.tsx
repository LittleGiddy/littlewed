'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewTenantPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', plan: 'BASIC' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    if (res.ok) router.push('/admin/dashboard');
    else alert('Failed');
    setLoading(false);
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">Create Organisation</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input className="w-full p-2 border rounded" placeholder="Organisation Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
        <input className="w-full p-2 border rounded" placeholder="Admin Email" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required />
        <input className="w-full p-2 border rounded" placeholder="Admin Password" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required />
        <select className="w-full p-2 border rounded" value={form.plan} onChange={e => setForm({...form, plan: e.target.value})}>
          <option value="BASIC">Basic (200 guests)</option>
          <option value="PRO">Pro (2000 guests)</option>
          <option value="ENTERPRISE">Enterprise (Unlimited)</option>
        </select>
        <button type="submit" disabled={loading} className="bg-indigo-600 text-white p-2 rounded w-full">Create</button>
      </form>
    </div>
  );
}