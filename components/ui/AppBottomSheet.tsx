'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useReducedMotion } from '@/lib/motion';

type AppBottomSheetProps = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Sticky footer, typically the primary action. */
  footer?: ReactNode;
  /** Cap the height as a fraction of the viewport. */
  maxHeight?: string;
  hideClose?: boolean;
};

/**
 * Contextual action surface: a bottom sheet on phones, a centred dialog on
 * tablets and up. Handles the things the 16 hand-rolled modals in this codebase
 * mostly skipped - Escape to close, body scroll lock, focus restore, and
 * dialog semantics.
 */
export default function AppBottomSheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxHeight = '88vh',
  hideClose = false,
}: AppBottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // Keep the latest onClose without making it an effect dependency, otherwise a
  // new callback identity on every parent render (e.g. on each keystroke in a
  // controlled form) would re-run focus management mid-typing and steal focus.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  const reduced = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;

      // Keep Tab inside the sheet while it is open.
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);

    // Move focus into the panel so keyboard and screen-reader users land inside.
    const timer = window.setTimeout(() => {
      const target =
        panelRef.current?.querySelector<HTMLElement>('[data-autofocus]') ??
        panelRef.current;
      target?.focus?.();
    }, 60);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(timer);
      restoreFocusRef.current?.focus?.();
    };
  }, [open]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center sm:justify-center sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-gray-900/45 backdrop-blur-[2px]"
            aria-hidden="true"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            tabIndex={-1}
            initial={reduced ? { opacity: 0 } : { y: '100%', opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { y: '100%', opacity: 0.6 }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: 'spring', damping: 30, stiffness: 320 }
            }
            className="relative w-full sm:max-w-lg bg-white rounded-t-sheet sm:rounded-sheet shadow-elev-3 flex flex-col overflow-hidden outline-none max-h-[88vh] sm:max-h-[85vh]"
            style={{ maxHeight }}
          >
            {/* Drag affordance - visual only on mobile. */}
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center shrink-0" aria-hidden="true">
              <div className="w-9 h-1 rounded-full bg-gray-300" />
            </div>

            {title || !hideClose ? (
              <div className="flex items-start gap-3 px-5 pt-3 sm:pt-5 pb-3 shrink-0">
                <div className="min-w-0 flex-1">
                  {title ? (
                    <h2 className="text-[17px] font-semibold text-gray-900 leading-tight">
                      {title}
                    </h2>
                  ) : null}
                  {description ? (
                    <p className="text-[13px] text-gray-400 mt-1 leading-snug">{description}</p>
                  ) : null}
                </div>
                {!hideClose ? (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="w-9 h-9 -mt-1 -mr-1 rounded-tap grid place-items-center text-gray-400 hover:bg-gray-100 hover:text-gray-600 active:bg-gray-200/70 transition shrink-0"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}

            <div className="px-5 pb-5 overflow-y-auto overscroll-contain grow min-h-0">
              {children}
            </div>

            {footer ? (
              <div className="shrink-0 border-t border-gray-100 px-5 py-3.5 bg-white/95 backdrop-blur pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:pb-3.5">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
