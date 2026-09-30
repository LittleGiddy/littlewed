import type { ReactNode } from 'react';

type AppPageHeaderProps = {
  /** Small uppercase label above the title, e.g. "ACCOUNT". */
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Primary actions, right-aligned on desktop and full-width stacked on mobile. */
  actions?: ReactNode;
  className?: string;
  /** Compact variant for nested pages that already have a shell header. */
  compact?: boolean;
};

/**
 * The eyebrow + serif title + muted description block that was duplicated
 * verbatim across seven client pages.
 */
export default function AppPageHeader({
  eyebrow,
  title,
  description,
  actions,
  className = '',
  compact = false,
}: AppPageHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 ${className}`}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-bold tracking-[1.5px] text-brand uppercase mb-1.5">
            {eyebrow}
          </p>
        ) : null}
        <h1
          className={`font-display font-black text-gray-900 leading-[1.15] tracking-tight ${
            compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
          }`}
        >
          {title}
        </h1>
        {description ? (
          <p className="text-[13px] sm:text-sm text-gray-400 mt-1.5 leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
