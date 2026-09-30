import type { ReactNode } from 'react';

type AppEmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  /** Primary call to action - the whole point of an empty state is the next step. */
  action?: ReactNode;
  secondaryAction?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * Calm, centred empty state with an optional action.
 * Replaces ~12 hand-rolled copies that all used a grey box + serif headline.
 */
export default function AppEmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  size = 'md',
  className = '',
}: AppEmptyStateProps) {
  const pad = size === 'sm' ? 'py-8' : 'py-14';
  const iconBox = size === 'sm' ? 'w-11 h-11' : 'w-14 h-14';

  return (
    <div className={`flex flex-col items-center text-center ${pad} px-6 ${className}`}>
      {icon ? (
        <div
          className={`${iconBox} rounded-blob bg-brand-soft text-brand grid place-items-center mb-4`}
        >
          {icon}
        </div>
      ) : null}
      <h3 className={`font-semibold text-gray-900 ${size === 'sm' ? 'text-sm' : 'text-base'}`}>
        {title}
      </h3>
      {description ? (
        <p className="text-[13px] text-gray-400 mt-1.5 max-w-xs leading-relaxed">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-5">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
