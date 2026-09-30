'use client';

import { AlertCircle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { Toaster as RHToast, resolveValue, toast } from 'react-hot-toast';
import type { DefaultToastOptions, Toast, ToastPosition } from 'react-hot-toast';

interface ToasterWithCloseProps {
  position?: ToastPosition;
  toastOptions?: DefaultToastOptions;
  reverseOrder?: boolean;
  gutter?: number;
  containerStyle?: CSSProperties;
  containerClassName?: string;
}

/**
 * A phone-capped width — near full-width on small screens, capped on desktop.
 * `min()` keeps toasts comfortable to read and thumb-friendly on any device.
 */
const TOAST_WIDTH = 'min(calc(100vw - 2rem), 26rem)';

/**
 * Semantic colours only: green means it worked, red means it failed, teal is
 * just "working on it", grey is informational. Read from CSS custom properties
 * so the palette stays in one place.
 */
const TYPE_CONFIG = {
  success: {
    Icon: CheckCircle2,
    badgeStyle: { backgroundColor: 'var(--color-success)', color: '#fff' },
    accentColor: 'var(--color-success)',
  },
  error: {
    Icon: AlertCircle,
    badgeStyle: { backgroundColor: 'var(--color-danger)', color: '#fff' },
    accentColor: 'var(--color-danger)',
  },
  loading: {
    Icon: Loader2,
    badgeStyle: { backgroundColor: 'var(--color-brand)', color: '#fff' },
    accentColor: 'var(--color-brand)',
  },
  default: {
    Icon: Info,
    badgeStyle: { backgroundColor: 'var(--color-gray-100)', color: 'var(--color-gray-700)' },
    accentColor: 'var(--color-gray-400)',
  },
} as const;

/** Thin progress bar that drains right-to-left, like a Material SnackBar timeout. */
function ProgressBar({ t, accent }: { t: Toast; accent: string }) {
  if (t.type === 'loading' || t.duration === Infinity || !t.visible) return null;
  return (
    <span
      className="toast-progress pointer-events-none absolute inset-x-3 bottom-0 h-[3px] rounded-full"
      style={{
        backgroundColor: accent,
        animationDuration: `${t.duration}ms`,
        animationDelay: `${-t.pauseDuration}ms`,
      }}
    />
  );
}

function ToastInner({ t }: { t: Toast }) {
  type ToastKind = keyof typeof TYPE_CONFIG;
  const kind: ToastKind = t.type === 'success' || t.type === 'error' || t.type === 'loading' ? t.type : 'default';
  const { Icon, badgeStyle, accentColor } = TYPE_CONFIG[kind];
  const message = resolveValue(t.message, t) as ReactNode;

  // Toasts that supply their own chrome (e.g. CheckInWelcomeToast) keep it.
  const hasCustomChrome = Boolean(t.style?.background && t.style.background !== 'transparent');

  // Custom icons passed via `toast('…', { icon })` are preserved in the badge.
  const badgeContent = t.icon !== undefined ? t.icon : <Icon size={18} strokeWidth={2.2} className={t.type === 'loading' ? 'animate-spin' : undefined} />;

  if (hasCustomChrome) {
    return <div className="w-full" style={{ width: TOAST_WIDTH }}>{message}</div>;
  }

  return (
    <div
      role={t.type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      style={{ width: TOAST_WIDTH }}
      className="pointer-events-auto relative flex min-h-12 items-center gap-3 overflow-hidden rounded-card border border-white/60 bg-white/90 p-3 pr-2.5 shadow-elev-3 backdrop-blur-xl"
    >
      <span
        aria-hidden
        className="absolute bottom-2 left-1.5 top-2 w-1 rounded-full"
        style={{ backgroundColor: accentColor }}
      />
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={badgeStyle}
      >
        {badgeContent}
      </span>
      <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-gray-800 sm:text-sm">
        {message}
      </span>
      {t.type !== 'loading' && (
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          aria-label="Dismiss notification"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-200/70 hover:text-gray-700"
        >
          <X size={15} />
        </button>
      )}
      <ProgressBar t={t} accent={accentColor} />
    </div>
  );
}

export default function ToasterWithClose(props: ToasterWithCloseProps) {
  const {
    position = 'bottom-center',
    toastOptions,
    reverseOrder,
    gutter,
    containerStyle,
    containerClassName,
  } = props;

  return (
    <RHToast
      position={position}
      toastOptions={toastOptions}
      reverseOrder={reverseOrder}
      gutter={gutter}
      containerStyle={containerStyle}
      containerClassName={containerClassName}
    >
      {(t) => <ToastInner t={t as Toast} />}
    </RHToast>
  );
}