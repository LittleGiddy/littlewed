// app/client/events/[id]/remind/ReminderCardPreview.tsx
// Lets the tenant see the card a specific guest will actually receive.
//
// The image comes from the server compositor rather than a CSS imitation, so
// what is on screen is byte-for-byte what WhatsApp will deliver.
import { useEffect, useState } from 'react';
import { Eye, Loader2, RefreshCw, User } from 'lucide-react';
import { AppBottomSheet } from '@/components/ui';

interface PreviewGuest {
  id: string;
  name: string;
  title?: string | null;
}

interface Props {
  eventId: string;
  /** Guests the tenant can cycle through, typically the ones selected to receive the reminder. */
  guests: PreviewGuest[];
  /** Called after the design has been saved, since the preview renders stored settings. */
  disabled?: boolean;
  disabledHint?: string;
}

export default function ReminderCardPreview({ eventId, guests, disabled, disabledHint }: Props) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [nonce, setNonce] = useState(0);
  // The fetched card is stored against the request that produced it, so
  // switching guest shows a spinner without needing a synchronous reset.
  const [result, setResult] = useState<{ key: string; src: string | null; error: string | null } | null>(
    null
  );

  // `guests` can shrink while the sheet is open, so derive a clamped index
  // rather than trusting the stored one — that avoids an effect purely to fix
  // an out-of-range value.
  const safeIndex = guests.length ? Math.min(index, guests.length - 1) : 0;
  const guest = guests[safeIndex];
  const guestId = guest?.id ?? null;

  // `nonce` busts any cached response after a design change.
  const requestKey = open && guestId ? `${eventId}:${guestId}:${nonce}` : null;

  useEffect(() => {
    if (!requestKey || !guestId) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async () => {
      try {
        const res = await fetch(
          `/api/events/${eventId}/reminder-card-preview?guestId=${encodeURIComponent(guestId)}&_=${nonce}`,
          { credentials: 'include' }
        );
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Could not build the preview');
        }
        objectUrl = URL.createObjectURL(await res.blob());
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setResult({ key: requestKey, src: objectUrl, error: null });
      } catch (e) {
        if (cancelled) return;
        setResult({
          key: requestKey,
          src: null,
          error: e instanceof Error ? e.message : 'Could not build the preview',
        });
      }
    })();
    // Object URLs hold the whole PNG in memory; release each one when replaced.
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [requestKey, guestId, nonce, eventId]);

  const fresh = result?.key === requestKey ? result : null;
  const status = !requestKey ? 'idle' : !fresh ? 'loading' : fresh.error ? 'error' : 'idle';
  const src = fresh?.src ?? null;
  const error = fresh?.error ?? null;

  const shift = (delta: number) => {
    if (guests.length < 2) return;
    setIndex((i) => (i + delta + guests.length) % guests.length);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex items-center gap-1.5 rounded-tap border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
      >
        <Eye size={15} className="text-brand" />
        Preview card
      </button>

      <AppBottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Card preview"
        description={
          guest
            ? `Exactly what ${guest.title ? `${guest.title} ` : ''}${guest.name} will receive.`
            : 'Pick a guest to preview their card.'
        }
      >
        {disabled ? (
          <p className="text-sm text-muted">{disabledHint}</p>
        ) : !guests.length ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="grid size-12 place-items-center rounded-full bg-surface-2 text-muted">
              <User size={20} />
            </span>
            <p className="text-sm font-semibold text-ink">No guests selected</p>
            <p className="max-w-[16rem] text-[13px] leading-relaxed text-muted">
              Choose at least one guest on the next step, then come back to check the card each of
              them will receive.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-card bg-[#1c1c1e] p-3">
              {status === 'loading' ? (
                <div className="flex aspect-[2/3] items-center justify-center">
                  <Loader2 size={26} className="animate-spin text-white/60" />
                </div>
              ) : status === 'error' ? (
                <div className="flex aspect-[2/3] flex-col items-center justify-center gap-2 px-6 text-center">
                  <p className="text-sm font-semibold text-white">Preview unavailable</p>
                  <p className="text-[13px] leading-relaxed text-white/60">{error}</p>
                  <button
                    type="button"
                    onClick={() => setNonce((n) => n + 1)}
                    className="mt-1 flex items-center gap-1.5 rounded-tap bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white"
                  >
                    <RefreshCw size={13} /> Try again
                  </button>
                </div>
              ) : src ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={src}
                  alt={`Reminder card for ${guest.name}`}
                  className="mx-auto block max-h-[52vh] w-auto rounded-tap"
                />
              ) : null}
            </div>

            {guests.length > 1 ? (
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => shift(-1)}
                  className="rounded-tap border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink"
                >
                  Previous
                </button>
                <span className="min-w-0 flex-1 truncate text-center text-[13px] font-semibold text-ink">
                  {guest.title ? `${guest.title} ` : ''}
                  {guest.name}
                </span>
                <button
                  type="button"
                  onClick={() => shift(1)}
                  className="rounded-tap border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-ink"
                >
                  Next
                </button>
              </div>
            ) : (
              <p className="text-center text-[13px] font-semibold text-ink">
                {guest.title ? `${guest.title} ` : ''}
                {guest.name}
              </p>
            )}

            <p className="text-center text-[11px] leading-relaxed text-muted">
              Names are drawn at the position you chose. Long names stay on one line — use the size
              slider if it crowds the design.
            </p>
          </div>
        )}
      </AppBottomSheet>
    </>
  );
}
