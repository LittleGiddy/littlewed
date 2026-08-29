'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Bell, X, BellRing } from 'lucide-react';
import toast from 'react-hot-toast';

const STORAGE_KEY = 'littlewed-push-choice'; // 'granted' | 'denied' | 'dismissed'

function playChime() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    [880, 1108].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.25, now + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.5);
    });
  } catch {
    /* audio unsupported */
  }
}

export default function PushManager() {
  const { data: session, status } = useSession();
  const [enabled, setEnabled] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
  );
  const [permission, setPermission] = useState<NotificationPermission | null>(
    () =>
      typeof window !== 'undefined' && 'Notification' in window
        ? Notification.permission
        : null
  );
  const [showPrompt, setShowPrompt] = useState(false);

  const isLoggedIn = status === 'authenticated' && !!session?.user;

  const supportsPush =
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'PushManager' in window;

  // ─── Register SW + subscribe once granted ───────────────────────────────
  useEffect(() => {
    if (!isLoggedIn || !supportsPush || !enabled) return;
    let cancelled = false;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const vapidRes = await fetch('/api/push/vapid-public-key', { credentials: 'include' });
        const vapid = await vapidRes.json();

        let sub = await reg.pushManager.getSubscription();
        if (!sub && vapid.publicKey) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapid.publicKey,
          });
        }
        if (sub && !cancelled) {
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(sub.toJSON()),
            credentials: 'include',
          });
        }
      } catch (e) {
        console.error('[PushManager] subscribe failed:', e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, supportsPush, enabled]);

  // ─── Hear pushes while the app is open → chime + toast ─────────────────
  useEffect(() => {
    if (!isLoggedIn || !supportsPush || !enabled) return;

    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.type !== 'LITTLEWED_PUSH') return;
      playChime();
      const body = data.payload?.body ? ` - ${data.payload.body}` : '';
      toast.success(`${data.payload?.title || 'Notification'}${body}`);
    };

    let active = false;
    (async () => {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js').catch(() => null);
      if (reg?.active) {
        active = true;
        navigator.serviceWorker.addEventListener('message', onMessage);
      }
    })();

    return () => {
      if (active) navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, [isLoggedIn, supportsPush, enabled]);

  // ─── Prompt after a delay if the user hasn't decided ────────────────────
  useEffect(() => {
    let userChoice: string | null = null;
    try {
      userChoice = localStorage.getItem(STORAGE_KEY);
    } catch {
      userChoice = null;
    }
    if (
      isLoggedIn &&
      supportsPush &&
      permission !== 'granted' &&
      userChoice !== 'denied'
    ) {
      const t = setTimeout(() => setShowPrompt(true), 1500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, status]);

  if (!isLoggedIn) return null;

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        setEnabled(true);
        localStorage.setItem(STORAGE_KEY, 'granted');
        setShowPrompt(false);
        playChime();
      } else {
        localStorage.setItem(STORAGE_KEY, 'denied');
        setShowPrompt(false);
      }
    } catch {
      /* ignore */
    }
  };

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'dismissed');
    setShowPrompt(false);
  };

  // Leave handle for external toggles (permission state is surfaced via prop context if needed).
  void permission;

  return (
    <>
      {showPrompt && (
        <div className="fixed bottom-4 right-4 z-[9999] max-w-sm w-[calc(100%-2rem)] bg-white rounded-2xl shadow-2xl border border-gray-100 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(13,75,75,0.08)] flex items-center justify-center flex-shrink-0 text-[#0D4B4B]">
            <Bell size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-800 text-sm">Get important updates</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Enable notifications to hear about check-ins, credits, and messages - even when the
              app isn&apos;t open.
            </p>
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={requestPermission}
                className="inline-flex items-center gap-1.5 bg-[#0D4B4B] text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-[#0A3939] transition"
              >
                <BellRing size={13} /> Enable
              </button>
              <button
                onClick={dismiss}
                className="text-xs font-medium text-gray-400 hover:text-gray-600 px-3 py-2"
              >
                Not now
              </button>
            </div>
          </div>
          <button onClick={dismiss} className="text-gray-300 hover:text-gray-500 flex-shrink-0" aria-label="Close">
            <X size={16} />
          </button>
        </div>
      )}
    </>
  );
}
