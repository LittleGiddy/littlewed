'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface VenueMapProps {
  lat: number;
  lng: number;
  /** Venue / place label shown on the map card. */
  label?: string;
  /** Full event address, shown under the label. */
  address?: string;
  accentColor?: string;
  primaryColor?: string;
}

function pinSvg(color: string) {
  return `<svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg"><path d="M17 0C7.6 0 0 7.6 0 17c0 11.7 17 25 17 25s17-13.3 17-25C34 7.6 26.4 0 17 0z" fill="${color}"/><circle cx="17" cy="17" r="7.5" fill="#fff"/></svg>`;
}

type Leaflet = typeof import('leaflet');

function initMap(container: HTMLElement, lat: number, lng: number, accentColor: string, scrollZoom = false) {
  return import('leaflet').then((L: Leaflet) => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="position:relative">${pinSvg(accentColor)}</div>`,
      iconSize: [34, 42],
      iconAnchor: [17, 42],
      popupAnchor: [0, -40],
    });

    const map = L.map(container, { zoomControl: true, scrollWheelZoom: scrollZoom });
    map.setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.marker([lat, lng], { icon, title: 'Venue' }).addTo(map);
    return map;
  });
}

export default function VenueMap({ lat, lng, label, address, accentColor = '#BE185D', primaryColor = '#BE185D' }: VenueMapProps) {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const modalMapRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&origin=MY_LOCATION&destination=${lat},${lng}&travelmode=driving`;
  const viewMapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

  // ── Preview map (interactive, clickable card) ────────────────────────────
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    let disposed = false;
    let instance: Awaited<ReturnType<typeof initMap>> | null = null;

    initMap(el, lat, lng, accentColor).then((map) => {
      if (disposed) {
        map.remove();
        return;
      }
      instance = map;
    });

    return () => {
      disposed = true;
      if (instance) instance.remove();
    };
  }, [lat, lng, accentColor]);

  // ── Modal map (initialised only once the modal is open) ──────────────────
  useEffect(() => {
    if (!open) return;
    const el = modalMapRef.current;
    if (!el) return;

    let disposed = false;
    let instance: Awaited<ReturnType<typeof initMap>> | null = null;

    initMap(el, lat, lng, accentColor, true).then((map) => {
      if (disposed) {
        map.remove();
        return;
      }
      instance = map;
      requestAnimationFrame(() => map.invalidateSize());
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    return () => {
      disposed = true;
      if (instance) instance.remove();
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, lat, lng, accentColor]);

  return (
    <>
      {/* Preview card — a real, visible map picture */}
      <div className="relative overflow-hidden rounded-2xl border-0 shadow-sm">
        <div ref={previewRef} className="h-56 w-full sm:h-64" />
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

              {/* Interactive map */}
              <div ref={modalMapRef} className="h-[45vh] min-h-64 w-full" />

              {/* Actions */}
              <div className="flex gap-3 border-t border-slate-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white transition-transform active:scale-[0.98]"
                  style={{ backgroundColor: primaryColor }}
                >
                  <Navigation size={16} /> Get Directions
                </a>
                <a
                  href={viewMapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <MapPin size={16} style={{ color: accentColor }} /> Open in Maps
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}