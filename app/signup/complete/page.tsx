// app/signup/complete/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Phone } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SignupCompletePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [needsPhone, setNeedsPhone] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    const businessName = localStorage.getItem('signup_business_name');
    const subdomain = localStorage.getItem('signup_subdomain');
    if (!businessName || !subdomain) {
      router.push('/client/dashboard');
      return;
    }
    setNeedsPhone(true);
  }, [session, status, router]);

  const completeSignup = async (phoneNumber: string) => {
    setSubmitting(true);
    try {
      const businessName = localStorage.getItem('signup_business_name');
      const subdomain = localStorage.getItem('signup_subdomain');
      const res = await fetch('/api/auth/complete-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, subdomain, phone: phoneNumber }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.removeItem('signup_business_name');
        localStorage.removeItem('signup_subdomain');
        toast.success('Organization created successfully!');
        router.push('/client/pending-activation');
      } else {
        toast.error(data.error || 'Failed to create organization');
        router.push('/signup');
      }
    } catch (error) {
      console.error('Signup complete error:', error);
      toast.error('Network error. Please try again.');
      router.push('/signup');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F8FA]">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-[#0D4B4B] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Completing sign up...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F8FA] px-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-lg p-8">
        <div className="w-14 h-14 rounded-2xl bg-[#0D4B4B]/5 flex items-center justify-center text-[#0D4B4B] mx-auto mb-4">
          {submitting ? <Loader2 className="w-7 h-7 animate-spin" /> : <Phone className="w-7 h-7" />}
        </div>
        <h1 className="font-serif text-2xl font-bold text-gray-900 text-center">Almost there</h1>
        <p className="text-sm text-gray-500 text-center mt-1 mb-6">
          One last step: add your phone number so we can reach you about your account.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!phone.trim()) {
              toast.error('Please enter your phone number');
              return;
            }
            completeSignup(phone.trim());
          }}
          className="space-y-4"
        >
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g., +255 700 000 000"
            className="w-full p-3 text-center text-base border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#0D4B4B] focus:border-transparent bg-gray-50"
          />
          <button
            type="submit"
            disabled={submitting || !phone.trim()}
            className="w-full py-3 bg-[#0D4B4B] text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 size={18} className="animate-spin" /> : 'Finish Creating My Organization'}
          </button>
        </form>
      </div>
    </div>
  );
}
