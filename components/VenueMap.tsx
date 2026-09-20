'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Navigation, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
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

function pinSvg(color: string) {
  return `<svg width="34" height="42" viewBox="0 0 34 42" xmlns="http://www.w3.org/2000/svg"><path d="M17 0C7.6 0 0 7.6 0 17c0 11.7 17 25 17 25s17-13.3 17-25C34 7.6 26.4 0 17 0z" fill="${color}"/><circle cx="17" cy="17" r="7.5" fill="#fff"/></svg>`;
}

interface StaticTile {
  z: number;
  x: number;
  y: number;
  px: number;
  py: number;
}

/**
 * A real map *image* for the preview card, rendered directly from OpenStreetMap
 * tiles (no API key, no iframe). The marker lands dead-centre via a pixel offset.
 */
function useStaticPreview(lat: number, lng: number, zoom = 15) {
  return useMemo(() => {
    const latRad = (lat * Math.PI) / 180;
    const n = 2 ** zoom;
    const xt = ((lng + 180) / 360) * n;
    const yt = (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n;
    const cx = Math.floor(xt);
    const cy = Math.floor(yt);
    const xIn = (xt - cx) * 256;
    const yIn = (yt - cy) * 256;

    const tiles: StaticTile[] = [];
    for (let dx = -1; dx <= 1; dx += 1) {
      for (let dy = -1; dy <= 1; dy += 1) {
        tiles.push({
          z: zoom,
          x: (((cx + dx) % n) + n) % n,
          y: Math.max(0, Math.min(n - 1, cy + dy)),
          px: (dx + 1) * 256,
          py: (dy + 1) * 256,
        });
      }
    }
    return { tiles, xOff: 128 - xIn, yOff: -yIn };
  }, [lat, lng, zoom]);
}

function StaticMapImage({ lat, lng, accentColor }: { lat: number; lng: number; accentColor: string }) {
  const { tiles, xOff, yOff } = useStaticPreview(lat, lng);

  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200" aria-hidden>
      <div
        className="absolute"
        style={{
          left: '50%',
          top: '50%',
          width: 768,
          height: 768,
          transform: `translate(calc(-50% + ${xOff}px), calc(-50% + ${yOff}px))`,
        }}
      >
        {tiles.map((t, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={t.x + '-' + t.y}
            src={`https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`}
            alt=""
            loading={i < 4 ? 'eager' : 'lazy'}
            draggable={false}
            referrerPolicy="no-referrer"
            className="absolute select-none"
            style={{ left: t.px, top: t.py, width: 256, height: 256 }}
          />
        ))}
      </div>
      <span
        className="absolute"
        style={{
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -100%)',
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))',
        }}
        dangerouslySetInnerHTML={{ __html: pinSvg(accentColor) }}
      />
      <span className="absolute bottom-1 right-2 text-[9px] font-medium text-white/90 drop-shadow">© OpenStreetMap</span>
    </div>
  );
}

type Leaflet = typeof import('leaflet');

function initMap(container: HTMLElement, lat: number, lng: number, accentColor: string) {
  return import('leaflet').then((L: Leaflet) => {
    const icon = L.divIcon({
      className: '',
      html: `<div style="position:relative">${pinSvg(accentColor)}</div>`,
      iconSize: [34, 42],
      iconAnchor: [17, 42],
      popupAnchor: [0, -40],
    });

    const map = L.map(container, { zoomControl: true, scrollWheelZoom: true });
    map.setView([lat, lng], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    L.marker([lat, lng], { icon, title: 'Venue' }).addTo(map);
    return map;
  });
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
  const modalMapRef = useRef<HTMLDivElement | null>(null);

  const venue = useMemo(
    () => (lat !== undefined && lng !== undefined ? { lat, lng } : null),
    [lat, lng],
  );
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

  // Interactive map (OSM tiles via Leaflet), initialised only once the modal is open.
  const mapNode = venue ? modalMapRef : null;
  useEffect(() => {
    if (!open || !mapNode || !mapNode.current || !venue) return;
    const el = mapNode.current;

    let disposed = false;
    let instance: Awaited<ReturnType<typeof initMap>> | null = null;

    initMap(el, venue.lat, venue.lng, accentColor).then((map) => {
      if (disposed) {
        map.remove();
        return;
      }
      instance = map;
      requestAnimationFrame(() => map.invalidateSize());
    });

    return () => {
      disposed = true;
      if (instance) instance.remove();
    };
  }, [open, mapNode, venue, accentColor]);

  return (
    <>
      {/* Preview card — the map itself is the card background (never a blank card) */}
      <div className="relative h-52 overflow-hidden rounded-2xl shadow-sm sm:h-64">
        {venue ? (
          <StaticMapImage lat={venue.lat} lng={venue.lng} accentColor={accentColor} />
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200" aria-hidden />
            <iframe
              src={embedUrl}
              className="pointer-events-none absolute inset-0 h-full w-full border-0"
              loading="eager"
              title="Venue map preview"
              tabIndex={-1}
              aria-hidden
            />
          </>
        )}
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
              {venue ? (
                <div ref={modalMapRef} aria-label="Venue map" className="h-[45vh] min-h-64 w-full bg-slate-100" />
              ) : (
                <iframe
                  src={embedUrl}
                  className="h-[45vh] min-h-64 w-full border-0"
                  loading="lazy"
                  title="Venue map"
                  allowFullScreen
                  referrerPolicy="no-referrer-when-downgrade"
                />
              )}

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