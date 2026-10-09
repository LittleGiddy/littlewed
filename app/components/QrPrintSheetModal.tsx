'use client';
// app/components/QrPrintSheetModal.tsx
//
// Downloads/prints standalone QR stickers for an event so the tenant can cut
// them out and stick them onto physical cards. Each sticker encodes the guest's
// card number, so scanning it with the staff scanner (POST /api/check-in)
// resolves the guest and shows the card as VALID.
import { useEffect, useState } from 'react';
import Image from 'next/image';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Printer,
  QrCode,
  RotateCw,
  X,
} from 'lucide-react';

interface QrGuest {
  id: string;
  name: string;
  cardNumber: string;
}

interface QrPrintSheetModalProps {
  eventId: string;
  onClose: () => void;
}

const PAGE_SIZE = 20;

export default function QrPrintSheetModal({
  eventId,
  onClose,
}: QrPrintSheetModalProps) {
  // Mounted only while open, so plain initial state is a fresh sheet.
  const [guests, setGuests] = useState<QrGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  // Bumped by "Try again" to re-run the effect below.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!eventId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/events/${eventId}/qr-codes`, {
          credentials: 'include',
          cache: 'no-store',
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const message =
            (data && typeof data.error === 'string' && data.error) ||
            `Request failed (${res.status})`;
          throw new Error(message);
        }
        setGuests(Array.isArray(data?.guests) ? data.guests : []);
        setError(null);
      } catch (err) {
        setGuests([]);
        setError(err instanceof Error ? err.message : 'Could not load QR codes.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [eventId, attempt]);

  // Escape closes the dialog.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Lock background scroll while open.
  useEffect(() => {
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevOverflow;
    };
  }, []);

  if (!eventId) return null;

  const pageCount = Math.max(1, Math.ceil(guests.length / PAGE_SIZE));
  const clampPage = (p: number) => Math.min(Math.max(p, 1), pageCount);
  const sheetUrl = `/api/events/${eventId}/qr-codes?sheet=1&page=${page}`;

  const retry = () => {
    setLoading(true);
    setError(null);
    setAttempt((a) => a + 1);
  };

  const openForPrint = () => {
    const w = window.open(sheetUrl, '_blank');
    if (!w) {
      toast.error('Pop-up blocked. Use "Download page" and print the image instead.');
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
      aria-label="Printable QR stickers"
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div className="modal-title">
            Print <span>QR Stickers</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="flex flex-col items-center gap-2 py-12 text-gray-400">
              <Loader2 size={26} className="animate-spin text-brand" />
              <p className="text-sm">Preparing your QR stickers…</p>
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
          ) : guests.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <QrCode className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No guests have card numbers yet.</p>
              <p className="text-xs mt-1">Add or import guests, then open this again.</p>
            </div>
          ) : (
            <>
              <div className="rounded-tap p-3 mb-4 flex items-center gap-3 bg-brand-soft">
                <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center text-brand shrink-0">
                  <QrCode size={17} />
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {guests.length} card{guests.length !== 1 ? 's' : ''} · one sticker per
                  card (shared cards share one sticker). Scanned stickers check the card
                  in as valid at the door.
                </p>
              </div>

              <div className="rounded-tap border border-gray-200 overflow-hidden mb-3">
                <Image
                  src={sheetUrl}
                  alt={`QR sticker sheet, page ${page} of ${pageCount}`}
                  width={1654}
                  height={2339}
                  unoptimized
                  className="w-full h-auto block"
                  onError={() => toast.error('Could not render this page of QR stickers.')}
                />
              </div>

              <div className="flex items-center justify-between gap-2 mb-4">
                <button
                  onClick={() => setPage((p) => clampPage(p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition flex items-center gap-1"
                >
                  <ChevronLeft size={14} /> Prev
                </button>
                <span className="text-xs text-gray-400">
                  Page {page} of {pageCount}
                </span>
                <button
                  onClick={() => setPage((p) => clampPage(p + 1))}
                  disabled={page === pageCount}
                  className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition flex items-center gap-1"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>

              <div className="flex gap-2">
                <a
                  href={sheetUrl}
                  download="qr-stickers.png"
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  <Download size={16} /> Download page
                </a>
                <button
                  onClick={openForPrint}
                  className="px-4 py-2 rounded-lg border border-brand text-brand text-sm font-semibold hover:bg-brand/5 transition flex items-center justify-center gap-2"
                >
                  <Printer size={16} /> Print
                </button>
              </div>

              <details className="mt-4">
                <summary className="text-xs font-medium text-gray-500 cursor-pointer">
                  Single QR codes ({guests.length})
                </summary>
                <div className="mt-2 max-h-52 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-tap">
                  {guests.map((g) => (
                    <div key={g.id} className="py-2 px-3 flex items-center gap-2">
                      <span className="flex-1 min-w-0 truncate text-sm text-gray-700">
                        {g.name}
                        <span className="text-xs text-gray-400 font-mono ml-2">
                          #{g.cardNumber}
                        </span>
                      </span>
                      <a
                        href={`/api/events/${eventId}/qr-codes?guestId=${g.id}`}
                        download={`qr-${g.cardNumber}.png`}
                        className="p-1.5 text-gray-500 hover:text-brand hover:bg-gray-50 rounded-lg transition"
                        title="Download this QR sticker"
                      >
                        <Download size={15} />
                      </a>
                    </div>
                  ))}
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  );
}