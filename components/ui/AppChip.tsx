import type { ReactNode } from 'react';

export type AppChipTone =
  | 'neutral'
  | 'brand'
  | 'success'
  | 'warn'
  | 'danger'
  | 'whatsapp'
  | 'outline';

const TONES: Record<AppChipTone, string> = {
  neutral: 'bg-gray-100 text-gray-600',
  brand: 'bg-brand/10 text-brand',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  danger: 'bg-danger-soft text-danger',
  whatsapp: 'bg-whatsapp/12 text-success',
  outline: 'bg-white text-gray-600 border border-gray-200',
};

type AppChipProps = {
  tone?: AppChipTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Filled chips read better for primary status; keep it opt-in. */
  solid?: boolean;
};

/**
 * Compact status pill. Used for credit balance, plan tier, channel routing,
 * RSVP status and send results.
 */
export default function AppChip({
  tone = 'neutral',
  icon,
  children,
  className = '',
  solid = false,
}: AppChipProps) {
  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none whitespace-nowrap',
        TONES[tone],
        solid && tone === 'brand' && 'bg-brand text-white',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {icon ? <span className="shrink-0 flex items-center" aria-hidden="true">{icon}</span> : null}
      {children}
    </span>
  );
}
