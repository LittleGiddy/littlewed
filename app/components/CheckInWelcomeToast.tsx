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
    <div className="relative text-center px-4 py-6 sm:px-6 sm:py-8 w-full max-w-md mx-auto">
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-3 right-3 p-2 text-gray-300 hover:text-gray-500 hover:bg-gray-100 rounded-full transition-colors"
      >
        <X size={20} />
      </button>

      <motion.div
        initial={{ scale: 0, rotate: -30 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 16 }}
        className="mx-auto mb-6 w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-green-100 flex items-center justify-center shadow-lg shadow-green-100/50"
      >
        <CheckCircle size={48} className="text-success" strokeWidth={2.5} />
      </motion.div>

      <p className="text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-gray-400 mb-2">Welcome</p>
      <p className="font-display text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 leading-tight break-words hyphens-auto">{name}</p>
      {subtitle && <p className="text-base sm:text-lg font-medium text-gray-600 mt-3 break-words hyphens-auto">{subtitle}</p>}

      <div className="mt-6 flex justify-center">
        <span className="text-sm font-semibold text-gray-400 animate-pulse">Auto-refreshing…</span>
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
        borderRadius: '24px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
        border: '1px solid #d1fae5',
        padding: '0',
        maxWidth: 'min(95vw, 560px)',
        width: 'min(95vw, 560px)',
        minWidth: '320px',
        zIndex: 9999,
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        whiteSpace: 'normal',
        backdropFilter: 'blur(8px)',
      },
      className: 'backdrop-blur-lg',
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
