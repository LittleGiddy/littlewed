// lib/maps.ts — helpers for turning a pasted Google Maps link into a useful
// venue map on the invitee page: a resolvable URL, coordinates for the map
// widget, and out-bound "directions" links.

const IFRAME_SRC_RE = /<iframe[^>]+src=["']([^"']+)["']/i;
const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);

export interface VenueLocation {
  lat: number;
  lng: number;
  label: string;
}

/** Normalise a pasted value (iframe snippet, bare URL, missing scheme) to a URL. */
export function normalizeMapInput(url?: string | null): string | null {
  if (!url || !url.trim()) return null;
  let raw = url.trim();
  const snippet = raw.match(IFRAME_SRC_RE);
  if (snippet) raw = snippet[1];
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  try {
    new URL(raw);
    return raw;
  } catch {
    return null;
  }
}

export function isGoogleShortLink(rawUrl: string): boolean {
  try {
    return SHORT_HOSTS.has(new URL(rawUrl).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** Follow a Google short link (maps.app.goo.gl / goo.gl) server-side. */
export async function resolveGoogleShortLink(rawUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(rawUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; MapsLink/1.0)' },
      cache: 'no-store',
    });
    clearTimeout(timeout);
    const finalUrl = res.url || '';
    return finalUrl && finalUrl !== rawUrl ? finalUrl : null;
  } catch {
    return null;
  }
}

/** Resolve a map link to its real (non-short) URL, if short. */
export async function resolveMapUrl(input?: string | null): Promise<string | null> {
  const rawUrl = normalizeMapInput(input);
  if (!rawUrl) return null;
  if (isGoogleShortLink(rawUrl)) {
    const resolved = await resolveGoogleShortLink(rawUrl);
    return resolved || rawUrl;
  }
  return rawUrl;
}

const AT_COORDS_RE = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const PB_COORDS_RE = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/;
const PLAIN_COORDS_RE = /^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/;

function decodeSafely(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

/** Pull coordinates + a human label out of a real Google Maps URL. */
export function parseVenueLocation(rawUrl: string): VenueLocation | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (!(host === 'google.com' || host.endsWith('.google.com'))) return null;

  const path = parsed.pathname;
  const search = parsed.searchParams;

  let label = '';
  const place = path.match(/\/place\/([^@/?]+)/);
  if (place) {
    label = decodeSafely(place[1]);
    label = label.replace(/-/g, ' ');
  }

  let lat: number | null = null;
  let lng: number | null = null;

  const at = path.match(AT_COORDS_RE);
  if (at) {
    lat = Number(at[1]);
    lng = Number(at[2]);
  }

  if (lat === null || lng === null) {
    const pb = path.match(PB_COORDS_RE);
    if (pb) {
      lat = Number(pb[1]);
      lng = Number(pb[2]);
    }
  }

  if (lat === null || lng === null) {
    for (const key of ['ll', 'q']) {
      const value = search.get(key);
      if (value) {
        const coords = value.split(',');
        if (coords.length === 2 && PLAIN_COORDS_RE.test(value)) {
          lat = Number(coords[0]);
          lng = Number(coords[1]);
          break;
        }
      }
    }
  }

  if (lat === null || lng === null || Number.isNaN(lat) || Number.isNaN(lng)) return null;

  if (!label) {
    const q = search.get('q');
    if (q && !PLAIN_COORDS_RE.test(q)) label = decodeSafely(q);
  }

  return { lat, lng, label };
}

/**
 * Resolve a map link and (if possible) its venue coordinates. Returns null
 * when no coordinates can be determined (link not resolvable / not a maps URL).
 */
export async function getVenueLocation(mapUrl?: string | null): Promise<VenueLocation | null> {
  const resolved = await resolveMapUrl(mapUrl);
  if (!resolved) return null;
  return parseVenueLocation(resolved);
}

/** Google Maps directions straight from the invitee's device to the venue. */
export function buildDirectionsUrl(venue: VenueLocation | { lat: number; lng: number } | string): string {
  if (typeof venue === 'string') {
    return `https://www.google.com/maps/dir/?api=1&origin=MY_LOCATION&destination=${encodeURIComponent(venue)}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&origin=MY_LOCATION&destination=${venue.lat},${venue.lng}&travelmode=driving`;
}

/** Plain "open the venue" link for browsers / native maps app. */
export function buildMapsUrl(venue: VenueLocation | { lat: number; lng: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${venue.lat},${venue.lng}`;
}

/** Hands off to Waze for turn-by-turn navigation to the venue. */
export function buildWazeUrl(venue: VenueLocation | { lat: number; lng: number } | string): string {
  if (typeof venue === 'string') {
    return `https://waze.com/ul?q=${encodeURIComponent(venue)}&navigate=yes`;
  }
  return `https://waze.com/ul?ll=${venue.lat},${venue.lng}&navigate=yes`;
}

/** Convert a real Google Maps URL into an iframe-friendly embed URL. */
export function buildGoogleMapsEmbedUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  const path = parsed.pathname;

  if (host.endsWith('.google.com') && path.startsWith('/maps/embed')) {
    return parsed.toString();
  }

  if ((host === 'google.com' || host.endsWith('.google.com')) && path.startsWith('/maps')) {
    if (!parsed.searchParams.has('output')) parsed.searchParams.set('output', 'embed');
    return parsed.toString();
  }

  if (host.includes('maps.') || parsed.searchParams.has('q')) {
    if (!parsed.searchParams.has('output')) parsed.searchParams.set('output', 'embed');
    return parsed.toString();
  }

  return null;
}

/** Convert a pasted map link (short / snippet / plain) into an embeddable URL. */
export async function googleMapsEmbedUrl(mapUrl?: string | null): Promise<string | null> {
  const resolved = await resolveMapUrl(mapUrl);
  if (!resolved) return null;
  return buildGoogleMapsEmbedUrl(resolved);
}