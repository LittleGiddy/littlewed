'use client';

import { useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const CHECK_INTERVAL_MS = 15 * 1000;    // how often we check the idle timer

export default function IdleSessionTimeout() {
  const lastActivityRef = useRef<number>(0);

  useEffect(() => {
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    // Treat mount time as the start of the idle window.
    lastActivityRef.current = Date.now();

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'keydown',
      'mousedown',
      'scroll',
      'touchstart',
      'wheel',
    ];

    events.forEach((evt) => window.addEventListener(evt, updateActivity, { passive: true }));

    const checkIdle = () => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        signOut({ redirect: true, callbackUrl: '/login' });
      }
    };

    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, updateActivity));
      clearInterval(interval);
    };
  }, []);

  return null;
}
