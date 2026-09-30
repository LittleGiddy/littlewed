import type { ReactNode } from 'react';

const SIZES = {
  xs: 'w-7 h-7 text-[11px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-xl',
} as const;

type AppAvatarProps = {
  name: string;
  imageUrl?: string | null;
  size?: keyof typeof SIZES;
  /** Rendered instead of initials when provided (e.g. a check-in badge). */
  children?: ReactNode;
  className?: string;
};

/**
 * Initial-based avatar. Falls back gracefully to a person icon when the name
 * has no letters at all, and uses a neutral grey ring rather than a heavy
 * coloured gradient so it sits quietly in lists.
 */
export default function AppAvatar({
  name,
  imageUrl,
  size = 'md',
  children,
  className = '',
}: AppAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase();

  return (
    <span
      className={[
        'shrink-0 rounded-full overflow-hidden grid place-items-center',
        'bg-gradient-to-br from-brand to-brand-dark text-white font-bold',
        SIZES[size],
        className,
      ].join(' ')}
      aria-hidden="true"
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="w-full h-full object-cover" />
      ) : children ? (
        children
      ) : initial ? (
        initial
      ) : (
        <span className="opacity-70">?</span>
      )}
    </span>
  );
}
