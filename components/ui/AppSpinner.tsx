import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';

type AppSpinnerProps = {
  size?: number;
  label?: string;
  className?: string;
};

/** Inline indeterminate spinner. The label is announced, the icon is not. */
export function AppSpinner({ size = 28, label = 'Loading', className = '' }: AppSpinnerProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-brand ${className}`} role="status">
      <Loader2 size={size} className="animate-spin" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/**
 * Full-area loading state. The two competing spinner styles in the codebase
 * (lucide + label, and a border spinner) are unified here.
 */
export default function AppProgressIndicator({
  label = 'Loading…',
  className = '',
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 min-h-[45vh] px-6 text-center ${className}`}
      role="status"
      aria-live="polite"
    >
      <Loader2 size={28} className="animate-spin text-brand" aria-hidden="true" />
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

/** Determinate bar, e.g. daily WhatsApp send cap. */
export function AppProgressBar({
  value,
  max = 100,
  tone = 'brand',
  className = '',
  barClassName = '',
}: {
  value: number;
  max?: number;
  tone?: 'brand' | 'warn' | 'danger' | 'success';
  className?: string;
  barClassName?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const fills = {
    brand: 'bg-brand',
    warn: 'bg-warn',
    danger: 'bg-danger',
    success: 'bg-success',
  } as const;

  return (
    <div
      className={`h-2 rounded-full bg-white border border-gray-200 overflow-hidden ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ease-soft ${fills[tone]} ${barClassName}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Wraps arbitrary content in an async busy state without unmounting layout. */
export function AppAsyncBoundary({
  loading,
  label,
  children,
  className = '',
}: {
  loading: boolean;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  if (!loading) return <>{children}</>;
  return <AppProgressIndicator label={label} className={className} />;
}
