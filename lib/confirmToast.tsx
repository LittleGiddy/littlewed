'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { TriangleAlert, Check, X } from 'lucide-react';
import { buttonClasses } from '@/components/ui/AppButton';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /**
   * When set, the user must type this exact phrase before the confirm button
   * becomes available. Used for destructive actions that can wipe a lot of
   * data in a single click (e.g. deleting a whole guest list).
   */
  requireText?: string;
}

/**
 * Deleting more than this many guests in one action, or deleting an event's
 * entire guest list, requires a typed confirmation instead of a single click.
 */
export const MASS_DELETE_THRESHOLD = 5;

export function isMassDelete(count: number, total: number): boolean {
  if (count <= 1) return false;
  return count >= MASS_DELETE_THRESHOLD || (total > 0 && count === total);
}

interface ConfirmCardProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
  requireText?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmCard({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  danger,
  requireText,
  onCancel,
  onConfirm,
}: ConfirmCardProps) {
  const [typed, setTyped] = useState('');
  const confirmed =
    !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();

  return (
    <div
      role="alertdialog"
      aria-labelledby="confirm-toast-title"
      aria-describedby={message ? 'confirm-toast-message' : undefined}
      className={`${
        visible ? 'animate-enter' : 'animate-leave'
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
          {requireText && (
            <div className="mt-3">
              <label
                htmlFor="confirm-toast-input"
                className="block text-xs text-gray-500 mb-1"
              >
                Type{' '}
                <span className="font-mono font-semibold text-gray-700">
                  {requireText}
                </span>{' '}
                to confirm
              </label>
              <input
                id="confirm-toast-input"
                autoFocus
                autoComplete="off"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && confirmed) onConfirm();
                }}
                placeholder={requireText}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-danger focus:border-transparent"
              />
            </div>
          )}
          {/* Stacked on the narrowest phones so labels never truncate. */}
          <div className="mt-4 flex flex-col-reverse gap-2 min-[380px]:flex-row min-[380px]:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className={`${buttonClasses({ variant: 'secondary', size: 'md' })} flex-1 min-[380px]:flex-none`}
            >
              <X size={15} />
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!confirmed}
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
  );
}

export function confirmToast(opts: ConfirmOptions): Promise<boolean> {
  const {
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    danger = false,
    requireText,
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
        <ConfirmCard
          visible={t.visible}
          title={title}
          message={message}
          confirmText={confirmText}
          cancelText={cancelText}
          danger={danger}
          requireText={requireText}
          onCancel={() => finish(false)}
          onConfirm={() => finish(true)}
        />
      ),
      { duration: Infinity, position: 'top-center' }
    );
  });
}
