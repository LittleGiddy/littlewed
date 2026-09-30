import type { ReactNode } from 'react';

/** Single shimmering block. */
export function AppSkeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-tap bg-gray-200/70 ${className}`} aria-hidden="true" />;
}

/** Mirrors the shape of a real card so the layout doesn't jump on load. */
export function AppSkeletonCard({ lines = 2, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`rounded-card border border-gray-200/80 bg-white p-4 sm:p-5 ${className}`} aria-hidden="true">
      <div className="flex items-center gap-3">
        <AppSkeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <AppSkeleton className="h-3 w-1/3" />
          <AppSkeleton className="h-2.5 w-1/2" />
        </div>
      </div>
      {lines > 0 ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <AppSkeleton key={i} className={`h-2.5 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AppSkeletonList({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: count }).map((_, i) => (
        <AppSkeletonCard key={i} lines={0} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

export function AppSkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`} role="status" aria-label="Loading">
      {Array.from({ length: lines }).map((_, i) => (
        <AppSkeleton key={i} className={`h-3 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

/** Generic "something is happening" block for a whole page section. */
export function AppSkeletonSection({ children, className = '' }: { children?: ReactNode; className?: string }) {
  return (
    <div className={className} role="status" aria-label="Loading">
      {children ?? (
        <div className="space-y-4">
          <AppSkeleton className="h-7 w-40" />
          <AppSkeleton className="h-24 w-full rounded-card" />
          <AppSkeleton className="h-24 w-full rounded-card" />
        </div>
      )}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
