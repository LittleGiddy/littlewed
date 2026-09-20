'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { buildDirectionsUrl } from '@/lib/maps';

interface VenueMapProps {
  /** Iframe-ready Google Maps embed URL (the real venue the tenant uploaded). */
  embedUrl: string;
  /** The original map link the tenant uploaded — what invitees should land on. */
  mapUrl?: string | null;
  /** Venue coordinates, when they could be extracted from the map link. */
  lat?: number;
  lng?: number;
  /** Venue / place label shown on the map card. */
  label?: string;
  /** Full event address, shown under the label. */
  address?: string;
  accentColor?: string;
  primaryColor?: string;
}

export default function VenueMap({
  embedUrl,
  mapUrl,
  lat,
  lng,
  label,
  address,
  accentColor = '#BE185D',
  primaryColor = '#BE185D',
}: VenueMapProps) {
  const [open, setOpen] = useState(false);

  const venue = lat !== undefined && lng !== undefined ? { lat, lng } : null;
  const openMapUrl = mapUrl || embedUrl;

  const directionsUrl = venue ? buildDirectionsUrl(venue) : null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      {/* Preview card — the map itself is the card background (never a blank card) */}
      <div className="relative h-52 overflow-hidden rounded-2xl shadow-sm sm:h-64">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" aria-hidden />
        <iframe
          src={embedUrl}
          className="pointer-events-none absolute inset-0 h-full w-full border-0"
          loading="eager"
          title="Venue map preview"
          tabIndex={-1}
          aria-hidden
        />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open map and get directions"
          className="absolute inset-x-0 bottom-0 top-0 w-full cursor-pointer"
        >
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent px-4 pb-3 pt-16 text-left">
            <span className="block text-sm font-bold text-white drop-shadow">{label || 'Venue map'}</span>
            {address && <span className="mt-0.5 block text-xs font-medium text-white/85 drop-shadow">{address}</span>}
            <span
              className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold text-white shadow-lg"
              style={{ backgroundColor: primaryColor }}
            >
              <Navigation size={13} /> View map &amp; directions
            </span>
          </span>
        </button>
      </div>

      {/* ── Directions modal (Flutter-style bottom-sheet on phones) ────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[1000] flex items-end justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 1 }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-w-lg sm:rounded-3xl"
            >
              {/* Handle bar (mobile) */}
              <div className="flex justify-center pt-2.5 sm:hidden">
                <span className="h-1 w-10 rounded-full bg-slate-200" />
              </div>

              {/* Header */}
              <div className="flex items-start justify-between gap-3 px-5 pt-3 pb-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900">{label || 'Venue'}</p>
                  {address && <p className="mt-0.5 truncate text-xs text-slate-500">{address}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close map"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Interactive map (embeds the tenant's actual venue location) */}
              <iframe
                src={embedUrl}
                className="h-[45vh] min-h-64 w-full border-0"
                loading="lazy"
                title="Venue map"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />

              {/* Actions */}
              <div className="border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {directionsUrl && (
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-transform active:scale-[0.98]"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Navigation size={16} /> Get Directions
                  </a>
                )}
                <a
                  href={openMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    directionsUrl
                      ? 'mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50'
                      : 'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-transform active:scale-[0.98]'
                  }
                  style={!directionsUrl ? { backgroundColor: primaryColor } : undefined}
                >
                  <MapPin size={16} style={{ color: directionsUrl ? accentColor : undefined }} /> Navigate to the venue
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}