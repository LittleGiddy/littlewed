'use client';
import { useSession } from 'next-auth/react';
import { Clock, AlertCircle, Mail, LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';

export default function PendingActivationPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email || 'your email';
  const userName = session?.user?.name || 'User';

  return (
    <div className="max-w-md mx-auto py-12 px-4 sm:px-6">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 bg-gradient-to-r from-[#0D4F4F] to-[#E8A598]" />

        <div className="p-6 sm:p-8 text-center">
          {/* Icon */}
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-2 border-[rgba(13,79,79,0.15)] animate-ping" />
            <div className="absolute inset-[-8px] rounded-full border-2 border-[rgba(232,165,152,0.2)] animate-pulse" />
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-[#0D4F4F] to-[#0A3D3D] flex items-center justify-center shadow-lg">
              <Clock className="w-8 h-8 text-white" />
            </div>
          </div>

          {/* Header */}
          <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0D4F4F] mb-2">
            <span className="w-2 h-2 rounded-full bg-[#E8A598]" />
            Account Status
          </div>

          <h1 className="font-serif text-2xl sm:text-3xl font-black text-gray-900 mb-2">
            Pending <span className="text-[#E8A598]">Activation</span>
          </h1>

          <p className="text-gray-500 text-sm mb-6">
            Your account is awaiting approval from an administrator.
            We'll notify you as soon as it's ready.
          </p>

          {/* Email pill */}
          <div className="inline-flex items-center gap-2 bg-[rgba(13,79,79,0.06)] border border-[rgba(13,79,79,0.12)] rounded-full px-4 py-2 text-sm font-semibold text-[#0D4F4F] mb-6">
            <Mail className="w-4 h-4" />
            {userEmail}
          </div>

          {/* Alert */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left flex items-start gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-sm text-amber-700">
              You'll receive an email notification at the address above once your account has been activated.
            </p>
          </div>

          {/* Footer */}
          <p className="text-xs text-gray-400">
            Think this is a mistake?{' '}
            <a href="mailto:support@littlewed.com" className="text-[#0D4F4F] font-semibold hover:underline">
              Contact support
            </a>
          </p>

          {/* Sign out option */}
          <button
            onClick={() => signOut({ redirect: true, callbackUrl: '/login' })}
            className="mt-4 text-sm text-gray-500 hover:text-[#0D4F4F] flex items-center justify-center gap-1 mx-auto"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}