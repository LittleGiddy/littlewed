// app/signup/complete/page.tsx
'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SignupCompletePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    const completeSignup = async () => {
      if (status === 'loading') return;

      if (!session) {
        router.push('/login');
        return;
      }

      // Get saved business info from localStorage
      const businessName = localStorage.getItem('signup_business_name');
      const subdomain = localStorage.getItem('signup_subdomain');

      if (!businessName || !subdomain) {
        // No signup data, redirect to dashboard or signup
        router.push('/client/dashboard');
        return;
      }

      try {
        const res = await fetch('/api/auth/complete-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessName,
            subdomain,
          }),
          credentials: 'include',
        });

        const data = await res.json();

        if (res.ok) {
          localStorage.removeItem('signup_business_name');
          localStorage.removeItem('signup_subdomain');
          toast.success('Organization created successfully! 🎉');
          router.push('/client/dashboard');
        } else {
          toast.error(data.error || 'Failed to create organization');
          router.push('/signup');
        }
      } catch (error) {
        console.error('Signup complete error:', error);
        toast.error('Network error. Please try again.');
        router.push('/signup');
      }
    };

    completeSignup();
  }, [session, status, router]);

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
    <div className="min-h-screen flex items-center justify-center bg-[#F5F8FA]">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-[#0D4B4B] animate-spin mx-auto mb-4" />
        <p className="text-gray-600">Setting up your workspace...</p>
      </div>
    </div>
  );
}