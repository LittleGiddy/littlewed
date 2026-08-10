'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, User, Phone, Hash, UserCheck, Sparkles, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const TITLES = ['Mr', 'Miss', 'Mrs', 'Dr', 'Ms', 'Prof'];

export default function AddGuestPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingWhatsApp, setCheckingWhatsApp] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<{ hasWhatsApp: boolean; waId?: string } | null>(null);
  const [form, setForm] = useState({
    title: 'Mr',
    name: '',
    phone: '',
    cardNumber: '',
    email: '',
  });
  const [isGeneratingCard, setIsGeneratingCard] = useState(false);

  // Auto-generate card number on load
  useEffect(() => {
    generateCardNumber();
  }, []);

  const generateCardNumber = async () => {
    setIsGeneratingCard(true);
    try {
      const res = await fetch('/api/guests/next-card-number', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) {
        setForm(prev => ({ ...prev, cardNumber: data.cardNumber }));
      }
    } catch {
      const rand = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      setForm(prev => ({ ...prev, cardNumber: `G-${rand}` }));
    } finally {
      setIsGeneratingCard(false);
    }
  };

  // ─── Check WhatsApp Number ──────────────────────────────────────────
  const checkWhatsApp = async () => {
  if (!form.phone) {
    toast.error('Please enter a phone number first');
    return;
  }
  setCheckingWhatsApp(true);
  setWhatsappStatus(null);
  try {
    const res = await fetch('/api/whatsapp/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: form.phone }),
    });
    const data = await res.json();
    setWhatsappStatus(data);
    if (data.hasWhatsApp) {
      toast.success('✅ Number has WhatsApp!');
    } else {
      // ✅ Fixed: Use toast() instead of toast.info()
      toast('ℹ️ Number does not have WhatsApp (SMS will be used)', {
        icon: 'ℹ️',
        duration: 4000,
      });
    }
  } catch {
    toast.error('Failed to check WhatsApp');
  } finally {
    setCheckingWhatsApp(false);
  }
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone are required');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          name: form.name.trim(),
          phone: form.phone.trim(),
          cardNumber: form.cardNumber.trim() || undefined,
          email: form.email.trim() || undefined,
          eventId,
        }),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok) {
        const channel = data.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS';
        toast.success(`Guest "${form.title} ${form.name}" added (${channel})`);
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
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/client/events/${eventId}`}
          className="text-gray-500 hover:text-[#0D4F4F] transition"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-serif text-2xl font-black text-gray-900">Add Guest</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <UserCheck size={15} />
              Title
            </label>
            <select
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
            >
              {TITLES.map(title => (
                <option key={title} value={title}>{title}</option>
              ))}
            </select>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <User size={15} />
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
              placeholder="e.g., John Doe"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Phone size={15} />
              Phone Number <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                className="flex-1 p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                placeholder="+255712345678"
                required
              />
              <button
                type="button"
                onClick={checkWhatsApp}
                disabled={checkingWhatsApp}
                className="px-4 py-2 bg-[#0D4F4F] text-white rounded-xl font-medium hover:bg-[#0A3D3D] transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {checkingWhatsApp ? <Loader2 size={16} className="animate-spin" /> : null}
                {checkingWhatsApp ? 'Checking...' : 'Check WhatsApp'}
              </button>
            </div>
            {whatsappStatus && (
              <p className={`text-xs mt-1.5 flex items-center gap-1.5 ${whatsappStatus.hasWhatsApp ? 'text-green-600' : 'text-amber-600'}`}>
                {whatsappStatus.hasWhatsApp ? (
                  <><CheckCircle size={12} /> WhatsApp number detected {whatsappStatus.waId && `(WA ID: ${whatsappStatus.waId})`}</>
                ) : (
                  <><XCircle size={12} /> SMS will be used (no WhatsApp detected)</>
                )}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-1">Include country code with + (e.g., +255...)</p>
          </div>

          {/* Card Number */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
              <Hash size={15} />
              Card Number
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={form.cardNumber}
                onChange={e => setForm(prev => ({ ...prev, cardNumber: e.target.value }))}
                className="flex-1 p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
                placeholder="e.g., G-001"
              />
              <button
                type="button"
                onClick={generateCardNumber}
                disabled={isGeneratingCard}
                className="px-4 py-2.5 bg-[#0D4F4F] text-white rounded-xl font-medium hover:bg-[#0A3D3D] transition disabled:opacity-50 flex items-center gap-1.5"
              >
                <Sparkles size={15} />
                Auto
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Leave empty for auto-generation, or enter a custom number</p>
          </div>

          {/* Email (optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
              className="w-full p-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4F4F] focus:border-transparent"
              placeholder="guest@example.com"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2.5 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-[#0D4F4F] to-[#0A3D3D] text-white py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Adding...' : 'Add Guest'}
            </button>
            <Link
              href={`/client/events/${eventId}`}
              className="px-6 border border-gray-300 rounded-xl py-2.5 font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}