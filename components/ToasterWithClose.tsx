'use client';

import { X } from 'lucide-react';
import { Toaster as RHToast, ToastBar, toast } from 'react-hot-toast';
import type { Toast, DefaultToastOptions, ToastPosition } from 'react-hot-toast';

interface ToasterWithCloseProps {
  position?: ToastPosition;
  toastOptions?: DefaultToastOptions;
  reverseOrder?: boolean;
  gutter?: number;
  containerStyle?: React.CSSProperties;
  containerClassName?: string;
}

export default function ToasterWithClose(props: ToasterWithCloseProps) {
  const {
    position = 'top-right',
    toastOptions,
    reverseOrder,
    gutter,
    containerStyle,
    containerClassName,
  } = props;

  const renderToast = (t: Toast) => {
    const typeClass =
      t.type === 'success'
        ? 'border-[#0D4B4B] text-[#0D4B4B]'
        : t.type === 'error'
          ? 'border-[#FF6B5C] text-[#c0392b]'
          : 'border-gray-200 text-gray-700';

    return (
      <div
        className={`${typeClass} bg-white rounded-2xl shadow-xl border`}
        style={{ pointerEvents: 'auto', position: 'relative', paddingRight: '34px' }}
      >
        <ToastBar toast={t}>
          {({ icon, message }) => (
            <>
              <span className="flex items-center">{icon}</span>
              <span className="flex-1 text-sm font-medium">{message}</span>
            </>
          )}
        </ToastBar>
        <button
          onClick={() => toast.dismiss(t.id)}
          aria-label="Dismiss"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <X size={14} />
        </button>
      </div>
    );
  };

  return (
    <RHToast
      position={position}
      toastOptions={toastOptions}
      reverseOrder={reverseOrder}
      gutter={gutter}
      containerStyle={containerStyle}
      containerClassName={containerClassName}
    >
      {(t) => renderToast(t as Toast)}
    </RHToast>
  );
}
