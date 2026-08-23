// app/client/pending-activation/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, AlertCircle, Mail, LogOut, Sparkles } from 'lucide-react';
import { signOut } from 'next-auth/react';

export default function PendingActivationPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // If user becomes active, redirect to dashboard
  useEffect(() => {
    const checkActivation = async () => {
      if (status === 'loading') return;
      
      if (!session) {
        router.push('/login');
        return;
      }

      // Check if user is now active
      try {
        const res = await fetch('/api/auth/check-tenant', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await res.json();

        // If user is now active, redirect to dashboard
        if (data.isActive === true) {
          router.push('/client/dashboard');
        }
      } catch (error) {
        console.error('Error checking activation status:', error);
      }
    };

    checkActivation();
    // Poll every 10 seconds to check if activated
    const interval = setInterval(checkActivation, 10000);
    return () => clearInterval(interval);
  }, [session, status, router]);

  const userEmail = session?.user?.email || 'your email';
  const userName = session?.user?.name || 'User';

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F8FA]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#0D4F4F] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F8FA] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Decorative top bar */}
        <div className="h-1.5 bg-gradient-to-r from-[#0D4F4F] via-[#E8A598] to-[#0D4F4F] rounded-t-2xl" />

        <div className="bg-white rounded-b-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 sm:p-8 text-center">
            {/* Icon with pulse animation */}
            <div className="relative w-24 h-24 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-2 border-[rgba(13,79,79,0.1)] animate-ping" />
              <div className="absolute inset-[-6px] rounded-full border-2 border-[rgba(232,165,152,0.15)] animate-pulse" />
              <div className="relative w-full h-full rounded-full bg-gradient-to-br from-[#0D4F4F] to-[#0A3D3D] flex items-center justify-center shadow-lg">
                <Clock className="w-10 h-10 text-white" />
              </div>
            </div>

            {/* Status badge */}
            <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-full px-4 py-1.5 mb-4">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Pending Approval</span>
            </div>

            <h1 className="font-serif text-2xl sm:text-3xl font-black text-gray-900 mb-2">
              Account <span className="text-[#E8A598]">Pending</span>
            </h1>

            <p className="text-gray-500 text-sm mb-2">
              Hi <strong>{userName}</strong>, your account is awaiting approval from an administrator.
            </p>
            <p className="text-gray-400 text-sm mb-6">
              You'll receive a notification as soon as your account is activated.
            </p>

            {/* Email pill */}
            <div className="inline-flex items-center gap-2 bg-[rgba(13,79,79,0.06)] border border-[rgba(13,79,79,0.12)] rounded-full px-4 py-2 text-sm font-semibold text-[#0D4F4F] mb-6">
              <Mail className="w-4 h-4" />
              {userEmail}
            </div>

            {/* Info alert */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left flex items-start gap-3 mb-6">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-amber-800">What happens next?</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  A super administrator will review and activate your account. This usually takes 24-48 hours.
                </p>
              </div>
            </div>

            {/* Auto-refresh indicator */}
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 mb-6">
              <Sparkles size={12} className="text-[#0D4F4F]" />
              <span>This page automatically refreshes to check your status</span>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={() => signOut({ redirect: true, callbackUrl: '/login' })}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>

              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition flex items-center justify-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Check Status Now
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-6">
              Think this is a mistake?{' '}
              <a href="mailto:support@littlewed.com" className="text-[#0D4F4F] font-semibold hover:underline">
                Contact support
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}