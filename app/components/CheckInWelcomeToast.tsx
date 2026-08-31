'use client';
import { motion } from 'framer-motion';
import { CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface CheckInWelcomeToastOptions {
  name: string;
  subtitle?: string;
  /** How long the toast stays visible before auto-dismiss (ms). */
  duration?: number;
  /** How long to wait before auto-refreshing (ms). Defaults to 3000. */
  refreshAfter?: number;
  /** Called on auto-refresh and on manual close. */
  onDismiss: () => void;
}

interface ContentProps {
  name: string;
  subtitle?: string;
  onClose: () => void;
}

function WelcomeContent({ name, subtitle, onClose }: ContentProps) {
  return (
    <div className="relative min-w-[260px] max-w-sm text-center px-2 py-2">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-0 right-0 p-1.5 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
      >
        <X size={16} />
      </button>

      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        className="mx-auto mb-3 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-green-100 flex items-center justify-center"
      >
        <CheckCircle size={40} className="text-green-600" strokeWidth={2.5} />
      </motion.div>

      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-1">Welcome</p>
      <p className="font-serif text-2xl sm:text-3xl font-black text-gray-900 leading-tight">{name}</p>
      {subtitle && <p className="text-sm font-medium text-gray-500 mt-1">{subtitle}</p>}

      <div className="mt-4 flex justify-center">
        <span className="text-[11px] font-semibold text-gray-400 animate-pulse">Auto-refreshing…</span>
      </div>
    </div>
  );
}

/**
 * Shows a big centered check-in welcome toast with an animated check icon,
 * "Welcome [Name]" text, and auto-refresh after `refreshAfter` ms. Manual
 * close also triggers a refresh. Call `toast.dismiss(id)` to clear it early.
 */
export function showCheckInWelcome({ name, subtitle, duration = 6000, refreshAfter = 3000, onDismiss }: CheckInWelcomeToastOptions) {
  const id = `checkin-welcome-${Date.now()}`;
  let refreshed = false;

  // Called on manual close: refresh (if not already) and dismiss the toast.
  const handleClose = () => {
    if (!refreshed) {
      refreshed = true;
      onDismiss();
    }
    toast.dismiss(id);
  };

  toast(
    <WelcomeContent name={name} subtitle={subtitle} onClose={handleClose} />,
    {
      id,
      duration,
      position: 'top-center',
      style: {
        background: '#fff',
        borderRadius: '20px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
        border: '1px solid #d1fae5',
        padding: '20px 24px',
      },
    }
  );

  // Auto-refresh shortly after the scan; the toast keeps showing until its
  // own (longer) duration elapses.
  window.setTimeout(() => {
    if (!refreshed) {
      refreshed = true;
      onDismiss();
    }
  }, refreshAfter);
}
