'use client';

import { useEffect } from 'react';
import { signOut } from 'next-auth/react';

const CHECK_INTERVAL_MS = 45 * 1000;

/**
 * Polls the server for session validity. When the account signs in on another
 * device (single-device login) the server-side guard invalidates this session's
 * token, so we sign the user out locally and send them back to the login page.
 */
export default function SessionRevokedGuard() {
  useEffect(() => {
    let cancelled = false;

    const checkOnce = async () => {
      try {
        const res = await fetch('/api/auth/session-check', {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && data && data.valid === false) {
          signOut({ redirect: true, callbackUrl: '/login?error=SessionExpired' });
        }
      } catch {
        // Network hiccup - try again on the next tick.
      }
    };

    checkOnce();
    const interval = setInterval(checkOnce, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return null;
}