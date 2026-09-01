'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, User, Phone, Hash, UserCheck, Coins, CheckCircle, XCircle, Loader2, 
  AlertCircle, Info, RotateCw, Users, UserPlus 
} from 'lucide-react';
import toast from 'react-hot-toast';

const TITLES = ['Mr', 'Miss', 'Mrs', 'Dr', 'Ms', 'Prof'];
const GUEST_TYPES = ['SINGLE', 'DOUBLE'];

export default function AddGuestPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingWhatsApp, setCheckingWhatsApp] = useState(false);
  const [whatsappStatus, setWhatsappStatus] = useState<{ hasWhatsApp: boolean; waId?: string; status?: string } | null>(null);
  const [form, setForm] = useState({
    title: 'Mr',
    name: '',
    phone: '',
    cardNumber: '',
    email: '',
    guestType: 'SINGLE',
  });
  const [guest2, setGuest2] = useState({
    title: 'Mr',
    name: '',
    phone: '',
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
      const res = await fetch('/api/guests/next-card-number', { 
        method: 'GET',
        credentials: 'include' 
      });
      const data = await res.json();
      if (res.ok && data.cardNumber) {
        setForm(prev => ({ ...prev, cardNumber: data.cardNumber }));
      } else {
        // Fallback: generate a random 5-digit number
        const rand = Math.floor(10000 + Math.random() * 90000).toString();
        setForm(prev => ({ ...prev, cardNumber: rand }));
      }
    } catch {
      const rand = Math.floor(10000 + Math.random() * 90000).toString();
      setForm(prev => ({ ...prev, cardNumber: rand }));
    } finally {
      setIsGeneratingCard(false);
    }
  };

  // ─── Check WhatsApp Number via NexSMS ────────────────────────────────
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
        credentials: 'include',
      });
      const data = await res.json();

      if (res.ok) {
        setWhatsappStatus(data);
        if (data.hasWhatsApp) {
          toast.success('Number has WhatsApp!', {
            icon: <CheckCircle size={18} className="text-green-600" />,
            duration: 3000,
          });
        } else {
          toast('Number does not have WhatsApp (SMS will be used)', {
            icon: <Info size={18} className="text-amber-500" />,
            duration: 4000,
          });
        }
      } else {
        toast.error(data.error || 'Failed to check WhatsApp', {
          icon: <AlertCircle size={18} className="text-red-500" />,
        });
      }
    } catch {
      toast.error('Failed to check WhatsApp', {
        icon: <AlertCircle size={18} className="text-red-500" />,
      });
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

    const isSharedDouble = form.guestType === 'DOUBLE' && guest2.name.trim() && guest2.phone.trim();
    if (isSharedDouble && (!guest2.name.trim() || !guest2.phone.trim())) {
      setError('Both guests must have a name and phone number');
      setLoading(false);
      return;
    }

    try {
      const payload: Record<string, any> = {
        title: form.title,
        name: form.name.trim(),
        phone: form.phone.trim(),
        cardNumber: form.cardNumber.trim() || undefined,
        email: form.email.trim() || undefined,
        eventId,
        guestType: form.guestType,
      };

      if (isSharedDouble) {
        payload.guest2 = {
          title: guest2.title,
          name: guest2.name.trim(),
          phone: guest2.phone.trim(),
          email: guest2.email.trim() || undefined,
        };
      }

      const res = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      const data = await res.json();
      if (res.ok) {
        const channel = data.routingChannel === 'whatsapp' ? 'WhatsApp' : 'SMS';
        if (isSharedDouble && data.sharedGuest) {
          toast.success(`Shared double card added: ${form.title} ${form.name} & ${guest2.title} ${guest2.name} (${channel})`, {
            icon: <UserCheck size={18} className="text-green-600" />,
            duration: 5000,
          });
        } else {
          const guestTypeLabel = data.guestType === 'DOUBLE' ? 'Double' : 'Single';
          toast.success(`Guest "${form.title} ${form.name}" added (${guestTypeLabel}, ${channel})`, {
            icon: <UserCheck size={18} className="text-green-600" />,
          });
        }
        router.push(`/client/events/${eventId}`);
      } else {
        setError(data.error || 'Failed to add guest');
        if (data.needsCredits) {
          toast.custom(
            (t) => (
              <div
                className={`${t.visible ? 'animate-enter' : 'animate-leave'
                  } max-w-md w-full bg-white shadow-lg rounded-2xl pointer-events-auto overflow-hidden border border-amber-200`}
              >
                <div className="p-4 bg-amber-50 border-b border-amber-200">
                  <h3 className="font-semibold text-amber-800 flex items-center gap-2 text-sm">
                    <Coins size={18} />
                    No credits left
                  </h3>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-600 mb-4">
                    {data.error || 'You have no credits remaining. Request more from the admin to keep adding guests.'}
                  </p>
                  <div className="flex gap-3">
                    <Link
                      href="/client/billing"
                      onClick={() => toast.dismiss(t.id)}
                      className="flex-1 bg-[#0D4B4B] text-white px-4 py-2.5 rounded-xl text-center text-sm font-semibold hover:bg-[#0A3939] transition"
                    >
                      Request Credits
                    </Link>
                    <button
                      onClick={() => toast.dismiss(t.id)}
                      className="flex-1 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-200 transition"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ),
            { duration: 8000 }
          );
        } else {
          toast.error(data.error || 'Failed to add guest', {
            icon: <AlertCircle size={18} className="text-red-500" />,
          });
        }
      }
    } catch {
      setError('Network error');
      toast.error('Network error. Please try again.', {
        icon: <AlertCircle size={18} className="text-red-500" />,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <style jsx global>{`
        /* ─── Prevent zoom on input focus ─── */
        input, select, textarea {
          font-size: 16px !important;
        }
        @media (max-width: 640px) {
          input, select, textarea {
            font-size: 16px !important;
          }
        }
      `}</style>

      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* ─── Header ─── */}
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <Link
            href={`/client/events/${eventId}`}
            className="flex-shrink-0 p-2 text-gray-500 hover:text-[#0D4B4B] hover:bg-[rgba(13,75,75,0.06)] rounded-xl transition"
          >
            <ArrowLeft size={20} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-serif text-xl sm:text-2xl font-black text-gray-900 truncate">Add Guest(s)</h1>
            <p className="text-xs sm:text-sm text-gray-500 truncate">
              Add a guest, or a plus-one so both share the same card
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push(`/client/events/${eventId}`)}
            className="flex-shrink-0 px-3 sm:px-4 py-1.5 sm:py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>

        {/* ─── Form Card ─── */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* ─── Title ─── */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <UserCheck size={14} className="sm:text-base" />
                Title
              </label>
              <select
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full p-2.5 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-white"
              >
                {TITLES.map(title => (
                  <option key={title} value={title}>{title}</option>
                ))}
              </select>
            </div>

            {/* ─── Full Name ─── */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <User size={14} className="sm:text-base" />
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2.5 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent"
                placeholder="e.g., John Doe"
                required
              />
            </div>

            {/* ─── Phone ─── */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Phone size={14} className="sm:text-base" />
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="flex-1 p-2.5 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent"
                  placeholder="+255712345678"
                  required
                />
                <button
                  type="button"
                  onClick={checkWhatsApp}
                  disabled={checkingWhatsApp}
                  className="px-3 sm:px-4 py-2.5 bg-[#0D4B4B] text-white rounded-xl font-medium hover:bg-[#0A3939] transition disabled:opacity-50 flex items-center justify-center gap-1.5 text-sm sm:text-base whitespace-nowrap"
                >
                  {checkingWhatsApp ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />}
                  {checkingWhatsApp ? 'Checking...' : 'Check WA'}
                </button>
              </div>
              {whatsappStatus && (
                <p className={`text-xs mt-1.5 flex items-center gap-1.5 ${whatsappStatus.hasWhatsApp ? 'text-green-600' : 'text-amber-600'}`}>
                  {whatsappStatus.hasWhatsApp ? (
                    <><CheckCircle size={12} /> WhatsApp number detected {whatsappStatus.waId && `(ID: ${whatsappStatus.waId})`}</>
                  ) : (
                    <><XCircle size={12} /> SMS will be used (no WhatsApp detected)</>
                  )}
                </p>
              )}
              <p className="text-xs text-gray-400 mt-1">Include country code with + (e.g., +255...)</p>
            </div>

            {/* ─── Guest Type ─── */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Users size={14} className="sm:text-base" />
                Guest Type
              </label>
              <select
                value={form.guestType}
                onChange={e => setForm(prev => ({ ...prev, guestType: e.target.value }))}
                className="w-full p-2.5 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-white"
              >
                {GUEST_TYPES.map(type => (
                  <option key={type} value={type}>
                    {type === 'SINGLE' ? 'Single (1 person)' : 'Double (2 people)'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Select DOUBLE to add a plus-one who shares the same card number — both phone numbers
                will receive the invitation card.
              </p>
            </div>

            {/* ─── Second Guest (only for shared DOUBLE card) ─── */}
            {form.guestType === 'DOUBLE' && (
              <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3 sm:p-4 space-y-3 sm:space-y-4">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
                  <UserPlus size={13} /> Second Guest (shared card)
                </p>
                <p className="text-[11px] text-amber-600 -mt-2">
                  This creates a 2-person double card. Both guests share one card number and receive one invitation card (2 credits).
                </p>

                {/* Title */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                  <select
                    value={guest2.title}
                    onChange={e => setGuest2(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-white"
                  >
                    {TITLES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={guest2.name}
                    onChange={e => setGuest2(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent"
                    placeholder="e.g., Jane Doe"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={guest2.phone}
                    onChange={e => setGuest2(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent"
                    placeholder="+255712345678"
                  />
                </div>

                {/* Email (optional) */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email (optional)</label>
                  <input
                    type="email"
                    value={guest2.email}
                    onChange={e => setGuest2(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full p-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent"
                    placeholder="guest2@example.com"
                  />
                </div>
              </div>
            )}

            {/* ─── Card Number ─── */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
                <Hash size={14} className="sm:text-base" />
                Card Number
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={form.cardNumber}
                  onChange={e => setForm(prev => ({ ...prev, cardNumber: e.target.value }))}
                  className="flex-1 p-2.5 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent"
                  placeholder="e.g., 00001"
                />
                <button
                  type="button"
                  onClick={generateCardNumber}
                  disabled={isGeneratingCard}
                  className="px-3 sm:px-4 py-2.5 bg-[#0D4B4B] text-white rounded-xl font-medium hover:bg-[#0A3939] transition disabled:opacity-50 flex items-center justify-center gap-1.5 text-sm sm:text-base whitespace-nowrap"
                >
                  {isGeneratingCard ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
                  {isGeneratingCard ? 'Generating...' : 'Auto'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">Auto-generated 5-digit number. You can customize it.</p>
            </div>

            {/* ─── Email (optional) ─── */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                className="w-full p-2.5 text-sm sm:text-base border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent"
                placeholder="guest@example.com"
              />
            </div>

            {/* ─── Error Message ─── */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm flex items-center gap-2">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}

            {/* ─── Actions ─── */}
            <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-2">
              <Link
                href={`/client/events/${eventId}`}
                className="w-full sm:flex-1 px-6 py-3 border border-gray-300 rounded-xl font-medium text-center hover:bg-gray-50 transition text-sm sm:text-base"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="w-full sm:flex-1 bg-gradient-to-r from-[#0D4B4B] to-[#0A3939] text-white py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <UserCheck size={18} />}
                {loading ? 'Adding...' : 'Add Guest'}
              </button>
            </div>
          </form>
        </div>

        {/* ─── Help Text ─── */}
        <p className="text-xs text-center text-gray-400 mt-4 px-2">
          Guest will receive their invitation card via their preferred channel (WhatsApp or SMS)
        </p>
      </div>
    </div>
  );
}