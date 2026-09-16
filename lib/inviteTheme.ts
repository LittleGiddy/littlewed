// lib/inviteTheme.ts
// Resolves the look of a guest invitation page from the event's per-event
// settings, falling back to the owning tenant's settings and then defaults.
// Also builds the shared CSS (variables, fonts, animations) used by both the
// landing page and the invitee (RSVP) page.
import { googleFontsImport } from './fonts';

export const GUEST_NAME_SCRIPT_FONT = 'Parisienne';

export interface GuestPageTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  themeColor: string;
  fontFamily: string;
  headerImage: string | null;
  coupleImage: string | null;
  title: string | null;
  subtitle: string | null;
  detailsTitle: string | null;
  rsvpTitle: string | null;
  footerNote: string | null;
  weddingTheme: string | null;
  themeColors: string[];
  contactPerson: string | null;
  contactPersonPhone: string | null;
  masterOfCeremony: string | null;
  mapUrl: string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveGuestPageTheme(event: any, tenant: any): GuestPageTheme {
  const pick = (key: string, fallback: string): string => {
    const v = event?.[key] ?? tenant?.[key];
    return typeof v === 'string' && v.trim() !== '' ? v : fallback;
  };
  const pickNullable = (key: string): string | null => {
    const v = event?.[key] ?? tenant?.[key];
    return typeof v === 'string' && v.trim() !== '' ? v : null;
  };
  const pickArray = (key: string): string[] => {
    const v = event?.[key] ?? tenant?.[key];
    if (Array.isArray(v)) {
      return v
        .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
        .slice(0, 6);
    }
    if (typeof v === 'string' && v.trim() !== '') {
      return v
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 6);
    }
    return [];
  };
  return {
    primaryColor: pick('guestPagePrimaryColor', '#BE185D'),
    secondaryColor: pick('guestPageSecondaryColor', '#6D28D9'),
    accentColor: pick('guestPageAccentColor', '#F6C445'),
    themeColor: pick('guestPageThemeColor', '#E8C46B'),
    fontFamily: pick('guestPageFontFamily', 'Playfair Display'),
    headerImage: pickNullable('guestPageHeaderImage'),
    coupleImage: pickNullable('guestPageCoupleImage'),
    title: pickNullable('guestPageTitle'),
    subtitle: pickNullable('guestPageSubtitle'),
    detailsTitle: pick('guestPageDetailsTitle', 'The Invitation'),
    rsvpTitle: pick('guestPageRsvpTitle', 'Will You Attend?'),
    footerNote: pick('guestPageFooterNote', 'With love'),
    weddingTheme: pickNullable('weddingTheme'),
    themeColors: pickArray('themeColors'),
    contactPerson: pickNullable('contactPerson'),
    contactPersonPhone: pickNullable('contactPersonPhone'),
    masterOfCeremony: pickNullable('masterOfCeremony'),
    mapUrl: pickNullable('mapUrl'),
  };
}

// Converts a Google Maps URL into a URL that can be embadded in an <iframe>.
// Short share links (maps.app.goo.gl) cannot be embedded - returns null for those.
export function googleMapsEmbedUrl(url?: string | null): string | null {
  if (!url || !url.trim()) return null;
  let raw = url.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'maps.app.goo.gl' || host === 'goo.gl') return null;

  const isGoogleMaps =
    (host === 'google.com' || host.endsWith('.google.com')) &&
    parsed.pathname.startsWith('/maps');

  if (isGoogleMaps) {
    if (!parsed.searchParams.has('output')) {
      parsed.searchParams.set('output', 'embed');
    }
    return parsed.toString();
  }

  // Generic embedded-map style: treat /maps/place/ or ?q= as embeddable.
  if (host.includes('maps.') || parsed.searchParams.has('q')) {
    if (!parsed.searchParams.has('output')) {
      parsed.searchParams.set('output', 'embed');
    }
    return parsed.toString();
  }

  return null;
}

export function fontImports(theme: GuestPageTheme): string {
  const main = googleFontsImport(theme.fontFamily);
  const script = googleFontsImport(GUEST_NAME_SCRIPT_FONT);
  return `${main}\n${script}`;
}

export function initialOf(name?: string | null): string {
  if (!name) return '?';
  const first = name.trim().split(/\s+/)[0] || '';
  return (first[0] || '?').toUpperCase();
}

// Builds the page-level <style> block: CSS variables + shared animations.
export function themeCss(theme: GuestPageTheme): string {
  return `
:root {
  --gp-primary: ${theme.primaryColor};
  --gp-secondary: ${theme.secondaryColor};
  --gp-accent: ${theme.accentColor};
  --gp-theme: ${theme.themeColor};
  --gp-font: ${JSON.stringify(theme.fontFamily.replace(/"/g, ''))};
}

.gp-script { font-family: 'Parisienne', cursive; }

.gp-fade-in { animation: gpFadeIn 1s ease-out both; }
.gp-fade-up { animation: gpFadeUp 0.9s ease-out both; }
.gp-fade-up-1 { animation-delay: 0.15s; }
.gp-fade-up-2 { animation-delay: 0.3s; }
.gp-fade-up-3 { animation-delay: 0.45s; }
.gp-delay-4 { animation-delay: 0.6s; }
.gp-delay-5 { animation-delay: 0.75s; }
.gp-delay-6 { animation-delay: 0.9s; }
@keyframes gpFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes gpFadeUp {
  from { opacity: 0; transform: translateY(26px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Fancy animated guest name: shimmering gold script text */
.gp-shimmer {
  background: linear-gradient(90deg, var(--gp-accent), #ffffff, #fff4d6, var(--gp-accent));
  background-size: 220% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: gpShimmer 3.2s ease-in-out infinite;
}
@keyframes gpShimmer {
  0% { background-position: 0% center; }
  100% { background-position: 220% center; }
}

/* Wedding theme color shimmer (for the theme color galaxy accent) */
.gp-theme-shimmer {
  background: linear-gradient(90deg, var(--gp-theme), #ffffff, var(--gp-theme));
  background-size: 220% auto;
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
  animation: gpShimmer 4s ease-in-out infinite;
}

/* Soft pulse ring around the couple monogram / photo */
.gp-ring-pulse { animation: gpPulseRing 3s ease-in-out infinite; }
@keyframes gpPulseRing {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.25), var(--gp-ring, 0 0 0 0 rgba(255,255,255,0)); }
  50% { box-shadow: 0 0 0 14px rgba(255,255,255,0), var(--gp-ring, 0 0 0 12px rgba(255,255,255,0.12)); }
}

/* Floating petals */
.gp-petal {
  position: absolute;
  opacity: 0.5;
  pointer-events: none;
  animation: gpFloat linear infinite;
  user-select: none;
}
@keyframes gpFloat {
  0% { transform: translateY(-8vh) rotate(0deg); opacity: 0; }
  10% { opacity: 0.55; }
  90% { opacity: 0.4; }
  100% { transform: translateY(108vh) rotate(340deg); opacity: 0; }
}

/* Slow zoom on hero background photo */
.gp-slow-zoom { animation: gpSlowZoom 22s ease-in-out infinite alternate; }
@keyframes gpSlowZoom {
  from { transform: scale(1); }
  to { transform: scale(1.12); }
}

/* Gentle floating for the couple card */
.gp-float-soft { animation: gpFloatSoft 5s ease-in-out infinite; }
@keyframes gpFloatSoft {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}

/* Elegant button glow */
.gp-btn-glow { animation: gpBtnGlow 2.6s ease-in-out infinite; }
@keyframes gpBtnGlow {
  0%, 100% { box-shadow: 0 8px 28px -8px var(--gp-theme); }
  50% { box-shadow: 0 10px 44px -6px var(--gp-theme); }
}

/* Divider shimmer line */
.gp-line-glow { animation: gpLineGlow 3s ease-in-out infinite; }
@keyframes gpLineGlow {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}

/* Lotus/heart ornament spin */
.gp-ornament-spin { animation: gpOrnamentSpin 14s linear infinite; }
@keyframes gpOrnamentSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Scale + fade reveal (frames, theme colors, wishes) */
.gp-fade-scale { animation: gpFadeScale 1s cubic-bezier(0.16,1,0.3,1) both; }
.gp-fade-scale-1 { animation-delay: 0.2s; }
.gp-fade-scale-2 { animation-delay: 0.35s; }
.gp-fade-scale-3 { animation-delay: 0.5s; }
@keyframes gpFadeScale {
  from { opacity: 0; transform: scale(0.92) translateY(14px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* Gentle swaying for decorations / letters */
.gp-sway { animation: gpSway 5s ease-in-out infinite; }
@keyframes gpSway {
  0%, 100% { transform: translateX(-6px) rotate(-2deg); }
  50% { transform: translateX(6px) rotate(2deg); }
}

/* Floating heart for the wishes section */
.gp-heartbeat { animation: gpHeartbeat 1.8s ease-in-out infinite; }
@keyframes gpHeartbeat {
  0%, 100% { transform: scale(1); }
  20% { transform: scale(1.12); }
  40% { transform: scale(1); }
}

/* Soft glow pulse for the theme color dots */
.gp-color-dot-glow { animation: gpColorGlow 2.8s ease-in-out infinite; }
@keyframes gpColorGlow {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.4); }
  50% { box-shadow: 0 0 14px 3px rgba(255,255,255,0.35); }
}`;
}