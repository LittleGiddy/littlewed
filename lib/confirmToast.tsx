'use client';

import toast from 'react-hot-toast';
import { TriangleAlert, Check, X } from 'lucide-react';

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
      toast.dismiss();
      resolve(result);
    };

    toast.custom(
      (t) => (
        <div
          className={`${
            t.visible ? 'animate-enter' : 'animate-leave'
          } max-w-sm w-full bg-white shadow-lg rounded-lg border border-gray-200 pointer-events-auto p-4`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                danger ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'
              }`}
            >
              <TriangleAlert size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{title}</p>
              {message && <p className="mt-1 text-sm text-gray-600">{message}</p>}
              <div className="mt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => finish(false)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <X size={14} />
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={() => finish(true)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-white ${
                    danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Check size={14} />
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
