'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Mail, Lock, CreditCard, ArrowLeft, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function NewTenantPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', plan: 'BASIC' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        router.push('/admin/tenants');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create tenant');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const plans = [
    { value: 'BASIC', label: 'Basic', description: '200 guests' },
    { value: 'PRO', label: 'Pro', description: '2,000 guests' },
    { value: 'ENTERPRISE', label: 'Enterprise', description: 'Unlimited guests' },
  ];

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <Link
        href="/admin/tenants"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft size={14} />
        Back to Tenants
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Organisation</h1>
        <p className="text-sm text-gray-500 mt-1">Set up a new tenant on the platform</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#0D4B4B]/5 flex items-center justify-center">
            <Building2 size={16} className="text-[#0D4B4B]" />
          </div>
          <h2 className="text-sm font-semibold text-gray-900">Tenant Details</h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Organisation Name
            </label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="e.g. Acme Events"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Admin Email
            </label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                placeholder="admin@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                required
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0D4B4B]/20 focus:border-[#0D4B4B] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Plan
            </label>
            <div className="grid grid-cols-3 gap-3">
              {plans.map(plan => (
                <button
                  key={plan.value}
                  type="button"
                  onClick={() => setForm({ ...form, plan: plan.value })}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    form.plan === plan.value
                      ? 'border-[#0D4B4B] bg-[#0D4B4B]/5'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {form.plan === plan.value && <CheckCircle size={14} className="text-[#0D4B4B]" />}
                    <p className="text-sm font-semibold text-gray-900">{plan.label}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{plan.description}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#0D4B4B] text-white text-sm font-semibold rounded-xl hover:bg-[#0D4B4B] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Building2 size={16} />
                  Create Organisation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
