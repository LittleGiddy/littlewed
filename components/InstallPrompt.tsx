'use client';

import { useEffect, useState } from 'react';
import { Download, X, Smartphone, ArrowDownToLine } from 'lucide-react';

const STORAGE_KEY = 'littlewed-install-dismissed';

type PromptLike = {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone() {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  );
}

function isIos() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const win = window as Window & { MSStream?: unknown };
  return iOS && !win.MSStream;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<PromptLike | null>(null);
  const [dismissed, setDismissed] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      (() => {
        try {
          return localStorage.getItem(STORAGE_KEY) === '1';
        } catch {
          return false;
        }
      })()
  );
  const [show, setShow] = useState(false);
  const [installing, setInstalling] = useState(false);

  const ios = isIos();
  const standalone = isStandalone();

  useEffect(() => {
    if (standalone || dismissed) return;

    const initShow = () => {
      if (!isStandalone()) setShow(true);
    };
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as unknown as PromptLike);
      initShow();
    };
    const onInstalled = () => setShow(false);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // Auto-show the install nudge after a short delay so it doesn't fight
    // with login/push prompts on first load.
    const t = setTimeout(initShow, 4000);

    return () => {
      clearTimeout(t);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [standalone, dismissed]);

  if (standalone || dismissed || !show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
    setShow(false);
  };

  const install = async () => {
    if (deferredPrompt) {
      setInstalling(true);
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
      setInstalling(false);
      setShow(false);
      return;
    }
    // Fallback (iOS etc.) — the banner already explains how.
    dismiss();
  };

  const body = ios ? (
    <>
      <p className="text-sm font-bold text-gray-800">Install LittleWed</p>
      <p className="text-xs text-gray-500 mt-0.5">
        Tap the <span className="inline-flex items-center gap-1 align-middle"><Smartphone size={12} /> Share</span> button in
        your browser, then choose <span className="font-semibold text-gray-700">“Add to Home Screen”</span>.
      </p>
    </>
  ) : (
    <>
      <p className="text-sm font-bold text-gray-800">Get it on your device</p>
      <p className="text-xs text-gray-500 mt-0.5">
        Install LittleWed for quick access and offline-ready check-ins.
      </p>
    </>
  );

  return (
    <>
      {/* Desktop: floating pill bottom-right — shows current installable state */}
      <div className="hidden sm:flex fixed bottom-4 right-4 z-[9999] items-center gap-3 bg-white rounded-2xl shadow-2xl border border-gray-100 pl-4 pr-2 py-2 max-w-sm">
        <div className="w-9 h-9 rounded-xl bg-[rgba(13,75,75,0.08)] flex items-center justify-center flex-shrink-0 text-[#0D4B4B]">
          <Download size={18} />
        </div>
        <div className="flex-1 min-w-0 py-0.5">{body}</div>
        {deferredPrompt && !ios && (
          <button
            onClick={install}
            disabled={installing}
            className="inline-flex items-center gap-1.5 bg-[#0D4B4B] text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-[#0A3939] transition disabled:opacity-60 flex-shrink-0"
          >
            <ArrowDownToLine size={13} />
            {installing ? 'Installing…' : 'Install'}
          </button>
        )}
        <button onClick={dismiss} aria-label="Dismiss" className="text-gray-300 hover:text-gray-500 flex-shrink-0">
          <X size={15} />
        </button>
      </div>

      {/* Mobile: bottom sheet banner */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-[9999] bg-white border-t border-gray-100 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] flex items-center gap-3 px-4 py-3.5">
        <div className="w-10 h-10 rounded-xl bg-[rgba(13,75,75,0.08)] flex items-center justify-center flex-shrink-0 text-[#0D4B4B]">
          <Download size={18} />
        </div>
        <div className="flex-1 min-w-0">{body}</div>
        <button
          onClick={install}
          disabled={installing}
          className="inline-flex items-center gap-1.5 bg-[#0D4B4B] text-white text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-[#0A3939] transition disabled:opacity-60 flex-shrink-0"
        >
          {ios ? <Smartphone size={13} /> : <ArrowDownToLine size={13} />}
          {installing ? 'Installing…' : ios ? 'How' : 'Install'}
        </button>
        <button onClick={dismiss} aria-label="Dismiss" className="text-gray-300 hover:text-gray-500 flex-shrink-0">
          <X size={16} />
        </button>
      </div>
    </>
  );
}
