'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import { AlertCircle, Download, Loader2, Printer, QrCode, RotateCw, X } from 'lucide-react';
import { confirmToast } from '@/lib/confirmToast';

interface EventQrCodeModalProps {
  eventId: string;
  onClose: () => void;
}

/**
 * Manages the single event-level "external" QR code.
 *
 * One code per event, printed on physical cards for guests who are NOT imported
 * into the system. The scanner recognises it and returns VALID on every scan —
 * nothing is stored or counted. Opening this modal creates the code if it does
 * not exist yet; "Regenerate" replaces it (and invalidates already-printed cards).
 */
export default function EventQrCodeModal({ eventId, onClose }: EventQrCodeModalProps) {
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Create the code if missing, then point <img> at the PNG endpoint.
  useEffect(() => {
    let active = true;
    const prepare = async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/qr-codes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'Could not prepare the QR code.');
        }
        if (!active) return;
        setQrUrl(`/api/events/${eventId}/qr-codes?v=${Date.now()}`);
        setError('');
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Could not prepare the QR code.');
      } finally {
        if (active) setLoading(false);
      }
    };
    prepare();
    return () => {
      active = false;
    };
  }, [eventId, attempt]);

  // Lock background scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const retry = () => {
    setLoading(true);
    setError('');
    setAttempt((a) => a + 1);
  };

  const regenerate = async () => {
    const ok = await confirmToast({
      title: 'Generate a new QR code?',
      message:
        'The current code will stop working. Any cards already printed with the old code must be reprinted.',
      confirmText: 'Regenerate',
      danger: true,
    });
    if (!ok) return;

    setRegenerating(true);
    try {
      const res = await fetch(`/api/events/${eventId}/qr-codes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotate: true }),
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not regenerate the QR code.');
      setQrUrl(`/api/events/${eventId}/qr-codes?v=${Date.now()}`);
      toast.success('New QR code generated.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not regenerate the QR code.');
    } finally {
      setRegenerating(false);
    }
  };

  const openForPrint = () => {
    if (!qrUrl) return;
    const w = window.open(qrUrl, '_blank');
    if (!w) {
      toast.error('Pop-up blocked. Use "Download" and print the image instead.');
      return;
    }
    w.addEventListener(
      'load',
      () => {
        try {
          w.focus();
          w.print();
        } catch {
          // Still printable from the opened tab.
        }
      },
      { once: true }
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="External QR code"
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div className="modal-title">
            External <span>QR Code</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
              <Loader2 size={26} className="animate-spin text-brand" />
              <p className="text-sm">Preparing your QR code…</p>
            </div>
          ) : error ? (
            <div>
              <div className="rounded-tap p-4 bg-danger-soft border border-danger-border text-red-800 text-sm flex items-start gap-2 mb-4">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
              <button
                onClick={retry}
                className="w-full btn-secondary flex items-center justify-center gap-2"
              >
                <RotateCw size={15} /> Try again
              </button>
            </div>
          ) : (
            <>
              <div className="rounded-tap p-3 mb-4 flex items-start gap-3 bg-brand-soft">
                <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center text-brand shrink-0">
                  <QrCode size={17} />
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  One code for this whole event. Print it on cards for guests who are
                  <strong> not imported</strong> to your list. Every scan shows as valid —
                  it can be scanned unlimited times and never creates a guest.
                </p>
              </div>

              {qrUrl && (
                <>
                  <div className="rounded-tap border border-gray-200 p-4 mb-4 bg-white">
                    <Image
                      src={qrUrl}
                      alt="External event QR code"
                      width={1024}
                      height={1024}
                      unoptimized
                      className="w-full h-auto max-w-[280px] mx-auto block"
                      onError={() => toast.error('Could not render the QR code.')}
                    />
                  </div>

                  <div className="flex gap-2">
                    <a
                      href={qrUrl}
                      download="event-qr.png"
                      className="flex-1 btn-primary flex items-center justify-center gap-2"
                    >
                      <Download size={16} /> Download
                    </a>
                    <button
                      onClick={openForPrint}
                      className="px-4 py-2 rounded-lg border border-brand text-brand text-sm font-semibold hover:bg-brand/5 transition flex items-center justify-center gap-2"
                    >
                      <Printer size={16} /> Print
                    </button>
                  </div>

                  <button
                    onClick={regenerate}
                    disabled={regenerating}
                    className="mt-3 w-full inline-flex items-center justify-center gap-2 text-xs font-medium text-gray-500 hover:text-gray-700 transition disabled:opacity-50"
                  >
                    {regenerating ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RotateCw size={14} />
                    )}
                    Regenerate code
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
