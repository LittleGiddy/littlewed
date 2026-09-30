'use client';

import toast from 'react-hot-toast';
import { TriangleAlert, Check, X } from 'lucide-react';
import { buttonClasses } from '@/components/ui/AppButton';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export function confirmToast(opts: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false,
  } = opts;

  return new Promise<boolean>((resolve) => {
    let resolved = false;
    const finish = (result: boolean) => {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', onKeyDown);
      toast.dismiss();
      resolve(result);
    };

    // Escape backs out of the dialog, matching the sheets it replaced.
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish(false);
    };
    document.addEventListener('keydown', onKeyDown);

    toast.custom(
      (t) => (
        <div
          role="alertdialog"
          aria-labelledby="confirm-toast-title"
          aria-describedby={message ? 'confirm-toast-message' : undefined}
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-sm w-full bg-white shadow-elev-3 rounded-card border border-gray-200 pointer-events-auto p-4`}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className={`shrink-0 w-9 h-9 rounded-full grid place-items-center ${
                danger ? 'bg-danger-soft text-danger' : 'bg-warn-soft text-warn'
              }`}
            >
              <TriangleAlert size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p id="confirm-toast-title" className="text-sm font-semibold text-gray-900">
                {title}
              </p>
              {message && (
                <p id="confirm-toast-message" className="mt-1 text-sm text-gray-600">
                  {message}
                </p>
              )}
              {/* Stacked on the narrowest phones so labels never truncate. */}
              <div className="mt-4 flex flex-col-reverse gap-2 min-[380px]:flex-row min-[380px]:justify-end">
                <button
                  type="button"
                  onClick={() => finish(false)}
                  className={`${buttonClasses({ variant: 'secondary', size: 'md' })} flex-1 min-[380px]:flex-none`}
                >
                  <X size={15} />
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => finish(true)}
                  className={`${buttonClasses({
                    variant: danger ? 'danger' : 'primary',
                    size: 'md',
                  })} flex-1 min-[380px]:flex-none`}
                >
                  <Check size={15} />
                  {confirmText}
                </button>
              </div>
            </div>
          </div>
        </div>
      ),
      { duration: Infinity, position: 'top-center' }
    );
  });
}
