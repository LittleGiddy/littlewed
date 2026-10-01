// app/client/events/[id]/contributions/widgets.tsx
// The animated summary tiles and progress ring used by the contributions
// overview. Split out of the manager so both the tenant screens and the public
// tracker can share the same visual language.
'use client';

import { motion } from 'framer-motion';
import { Coins, TrendingUp, Users, CheckCircle2, Hourglass, CircleDashed } from 'lucide-react';
import { formatTZS } from '@/lib/contributions';
import { useReducedMotion, useTransition, motionEase } from '@/lib/motion';

export interface StatTile {
  key: string;
  label: string;
  value: number;
  currency: string;
  icon: typeof Coins;
  tone: 'brand' | 'success' | 'warn' | 'muted';
}

const TONE_RING: Record<StatTile['tone'], string> = {
  brand: 'bg-brand/10 text-brand',
  success: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  muted: 'bg-surface-2 text-muted',
};

export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  const transition = useTransition();

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {tiles.map((tile, i) => (
        <motion.div
          key={tile.key}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition, delay: i * 0.04 }}
          className="rounded-card border border-line bg-surface p-3.5"
        >
          <span className={`mb-2 grid size-8 place-items-center rounded-blob ${TONE_RING[tile.tone]}`}>
            <tile.icon size={15} aria-hidden="true" />
          </span>
          {/* Counts are the number here, so they get tabular figures and an
              animated count rather than a formatted currency string. */}
          <p className="font-display text-xl leading-none text-ink tabular-nums">{tile.value}</p>
          <p className="mt-1 text-[11px] font-medium leading-tight text-muted">{tile.label}</p>
          <span className="sr-only">
            {tile.key === 'outstanding'
              ? `${tile.value} ${tile.currency} outstanding`
              : `${tile.value} ${tile.label.toLowerCase()}`}
          </span>
        </motion.div>
      ))}
    </div>
  );
}

export function buildTiles(args: {
  collected: number;
  currency: string;
  total: number;
  pending: number;
  partial: number;
  paid: number;
  outstanding: number;
}): StatTile[] {
  return [
    {
      key: 'outstanding',
      label: 'Still outstanding',
      value: args.outstanding,
      currency: args.currency,
      icon: TrendingUp,
      tone: args.outstanding > 0 ? 'warn' : 'success',
    },
    {
      key: 'notStarted',
      label: 'Not started',
      value: args.pending,
      currency: args.currency,
      icon: CircleDashed,
      tone: 'muted',
    },
    {
      key: 'partial',
      label: 'Part paid',
      value: args.partial,
      currency: args.currency,
      icon: Hourglass,
      tone: 'warn',
    },
    {
      key: 'paid',
      label: 'Completed',
      value: args.paid,
      currency: args.currency,
      icon: CheckCircle2,
      tone: 'success',
    },
  ];
}

interface ProgressRingProps {
  /** 0-100. Clamped. */
  pct: number;
  collected: number;
  target: number | null;
  currency: string;
  size?: number;
}

/**
 * Circular progress for the headline figure. Animates from the previous value
 * rather than from zero so a status change reads as movement, not a reset.
 */
export function ProgressRing({
  pct,
  collected,
  target,
  currency,
  size = 148,
}: ProgressRingProps) {
  const reduced = useReducedMotion();
  const stroke = 11;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id="contribution-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" />
            <stop offset="100%" stopColor="var(--color-brand-soft)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-2)"
          strokeWidth={stroke}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#contribution-ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={false}
          animate={{ strokeDashoffset: c * (1 - clamped / 100) }}
          transition={reduced ? { duration: 0 } : { duration: 0.75, ease: motionEase }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Collected</p>
          <p className="mt-0.5 font-display text-[22px] leading-none text-ink">
            {formatTZS(collected, currency)}
          </p>
          {target !== null ? (
            <p className="mt-1 text-[11px] text-muted">of {formatTZS(target, currency)}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Horizontal progress bar with a sliding fill, for the compact variant. */
export function ProgressBar({
  pct,
  label,
  className = '',
}: {
  pct: number;
  label: string;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={`h-2 overflow-hidden rounded-full bg-surface-2 ${className}`}
    >
      <motion.div
        className="h-full rounded-full bg-brand"
        initial={false}
        animate={{ width: `${clamped}%` }}
        transition={reduced ? { duration: 0 } : { duration: 0.6, ease: motionEase }}
      />
    </div>
  );
}

export const STATUS_ICONS = {
  PENDING: CircleDashed,
  PARTIAL: Hourglass,
  PAID: CheckCircle2,
} as const;

export { Coins, Users };
