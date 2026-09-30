import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion';

export type AppSegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  /** Trailing count/badge, e.g. number of guests on each channel. */
  badge?: ReactNode;
  /** Per-option active colour. Defaults to brand teal. */
  activeClassName?: string;
};

type AppSegmentedControlProps<T extends string> = {
  options: AppSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  size?: 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
};

/**
 * iOS/Material style segmented control. Implemented as a radio group so arrow
 * keys and screen readers behave correctly, with a sliding indicator.
 */
export default function AppSegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  fullWidth = true,
  className = '',
}: AppSegmentedControlProps<T>) {
  const reduced = useReducedMotion();
  const activeIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const h = size === 'lg' ? 'h-12' : 'h-11';

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = options[(activeIndex + delta + options.length) % options.length];
    if (next) onChange(next.value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={`relative flex gap-1 rounded-blob bg-gray-200/60 p-1 ${fullWidth ? 'w-full' : ''} ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={[
              'relative flex-1 rounded-tap font-semibold',
              'transition-colors duration-150 ease-soft',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              h,
              size === 'lg' ? 'text-[15px]' : 'text-sm',
              active ? 'text-white' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {active ? (
              <motion.span
                layoutId="app-segmented-indicator"
                aria-hidden="true"
                className={`absolute inset-0 rounded-tap shadow-elev-1 ${
                  option.activeClassName ?? 'bg-brand'
                }`}
                transition={
                  reduced ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 380 }
                }
              />
            ) : null}
            <span className="relative z-10 inline-flex items-center justify-center gap-2 px-2">
              {option.icon ? (
                <span className="shrink-0 flex items-center" aria-hidden="true">
                  {option.icon}
                </span>
              ) : null}
              {option.label}
              {option.badge ? (
                <span
                  className={`text-[11px] font-semibold ${
                    active ? 'text-white/80' : 'text-gray-400'
                  }`}
                >
                  {option.badge}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
