'use client';

import { useSyncExternalStore } from 'react';

/**
 * Respects the user's reduced-motion preference.
 *
 * Framer Motion keeps animating even when the OS-level "reduce motion" setting
 * is on, so every animated component feeds this into its `initial`/`animate`/
 * `exit` props to collapse transitions to a no-op while still rendering the
 * final state.
 *
 * `useSyncExternalStore` is used rather than state-in-an-effect: the media
 * query is an external store, and subscribing this way avoids the extra
 * cascading render an effect would cause on mount.
 */
const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(callback: () => void) {
  const mediaQuery = window.matchMedia(QUERY);
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

/** Assume motion is allowed during SSR so the first paint is not a layout shift. */
function getServerSnapshot() {
  return false;
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Shared timing so every transition in the app feels like one system. */
export const motionEase = [0.22, 1, 0.36, 1] as const;

/** Standard durations (seconds) - kept inside the 150-250ms band. */
export const motionDuration = {
  fast: 0.16,
  base: 0.22,
  slow: 0.28,
} as const;

/**
 * Spread onto a Framer Motion transition prop. Collapses to instant when the
 * user prefers reduced motion.
 */
export function useTransition(duration: number = motionDuration.base) {
  const reduced = useReducedMotion();
  return reduced ? { duration: 0 } : { duration, ease: motionEase };
}
