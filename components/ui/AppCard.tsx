import { createElement, type ElementType, type HTMLAttributes, type ReactNode } from 'react';

export type AppCardTone = 'plain' | 'raised' | 'tinted' | 'outline';

const TONES: Record<AppCardTone, string> = {
  // Default: white surface, hairline border, barely-there elevation.
  plain: 'bg-white border-gray-200/80 shadow-elev-1',
  raised: 'bg-white border-gray-200/70 shadow-elev-2',
  // Soft teal - for the currently selected/active item in a list.
  tinted: 'bg-brand-soft border-brand/20',
  outline: 'bg-white border-gray-200',
};

type AppCardProps = HTMLAttributes<HTMLElement> & {
  tone?: AppCardTone;
  /** Adds a press scale, for cards that are themselves tap targets. */
  interactive?: boolean;
  padded?: boolean;
  as?: ElementType;
};

export default function AppCard({
  tone = 'plain',
  interactive = false,
  padded = true,
  as,
  className = '',
  children,
  ...rest
}: AppCardProps) {
  const Tag = (as ?? 'div') as ElementType;

  return createElement(
    Tag,
    {
      className: [
        'rounded-card border',
        TONES[tone],
        padded && 'p-4 sm:p-5',
        interactive &&
          'cursor-pointer transition-all duration-150 ease-soft active:scale-[0.985] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        className,
      ]
        .filter(Boolean)
        .join(' '),
      ...rest,
    },
    children
  );
}

/** Small uppercase eyebrow above a card or section title. */
export function AppCardTitle({
  title,
  subtitle,
  action,
  className = '',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h3 className="text-[15px] font-semibold text-gray-900 leading-tight">{title}</h3>
        {subtitle ? <p className="text-[13px] text-gray-400 mt-0.5 leading-snug">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
