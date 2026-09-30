import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export type AppButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'whatsapp';

export type AppButtonSize = 'sm' | 'md' | 'lg';

const VARIANTS: Record<AppButtonVariant, string> = {
  // Deep teal, the single primary action colour in the app.
  primary:
    'bg-brand text-white shadow-brand-sm hover:bg-brand-800 active:bg-brand-deep',
  // Soft teal fill - selected/secondary state, never competes with primary.
  secondary:
    'bg-brand-soft text-brand border border-brand/15 hover:bg-brand-100 active:bg-brand-100',
  outline:
    'bg-white text-gray-700 border border-gray-200 hover:border-brand/40 hover:text-brand active:bg-gray-50',
  ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200/70',
  danger:
    'bg-danger text-white shadow-sm hover:brightness-95 active:brightness-90',
  whatsapp:
    'bg-whatsapp text-white shadow-sm hover:brightness-95 active:brightness-90',
};

// Minimum 44px touch target at md/lg; sm stays compact for dense rows.
const SIZES: Record<AppButtonSize, string> = {
  sm: 'h-9 px-3 text-[13px] gap-1.5 rounded-tap',
  md: 'h-11 px-4 text-sm gap-2 rounded-tap',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-tap',
};

export function buttonClasses({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  className = '',
}: {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return [
    'inline-flex items-center justify-center font-semibold',
    'transition-all duration-150 ease-soft select-none',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
    'disabled:opacity-45 disabled:pointer-events-none',
    VARIANTS[variant],
    SIZES[size],
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');
}

type AppButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: AppButtonVariant;
  size?: AppButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  loadingText?: string;
  icon?: ReactNode;
  iconRight?: ReactNode;
};

export default function AppButton({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  loadingText,
  icon,
  iconRight,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: AppButtonProps) {
  return (
    <button
      type={type}
      // aria-busy tells screen readers the control is working; the spinner is
      // decorative so it is hidden from the accessibility tree.
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={buttonClasses({ variant, size, fullWidth, className })}
      {...rest}
    >
      {loading ? (
        <>
          <Loader2 size={size === 'sm' ? 14 : 16} className="animate-spin" aria-hidden="true" />
          {loadingText ? <span>{loadingText}</span> : children ? <span className="sr-only">{children}</span> : null}
        </>
      ) : (
        <>
          {icon ? <span className="shrink-0 flex items-center" aria-hidden="true">{icon}</span> : null}
          {children}
          {iconRight ? <span className="shrink-0 flex items-center" aria-hidden="true">{iconRight}</span> : null}
        </>
      )}
    </button>
  );
}
