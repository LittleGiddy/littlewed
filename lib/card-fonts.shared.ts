// lib/card-fonts.shared.ts
// The single source of truth for which fonts a card can be drawn in.
//
// Kept free of Node-only imports so the browser designer and the server
// renderer can both read it. That matters because a preview that renders a
// different typeface than the delivered card is worse than no preview at all:
// the designer approves one image and the guest receives another.
//
// Historically the designer offered 19 fonts while only four TTF families
// existed server-side, with the rest aliased onto Playfair Display. Fifteen of
// those options therefore previewed as Georgia and shipped as Playfair. The
// palette is now exactly the families that can genuinely be rendered.

export interface CardFont {
  /** Value stored on the event, and used as the CSS family name. */
  id: string;
  label: string;
  /** Only one weight exists for this family, so no faux-bold is applied. */
  regularOnly?: boolean;
}

export const CARD_FONTS: CardFont[] = [
  { id: 'Playfair Display', label: 'Playfair Display' },
  { id: 'DM Sans', label: 'DM Sans' },
  { id: 'Dancing Script', label: 'Dancing Script' },
  { id: 'Great Vibes', label: 'Great Vibes', regularOnly: true },
];

export const CARD_FONTS_BY_ID: Record<string, CardFont> = Object.fromEntries(
  CARD_FONTS.map((f) => [f.id, f])
);

/**
 * Resolves any stored font value to a family that actually exists.
 *
 * Values written before the palette was narrowed are mapped to their nearest
 * surviving relative rather than silently falling back to Playfair, so an old
 * event keeps the face it was designed with.
 */
export function resolveCardFont(fontFamily: string | null | undefined): string {
  if (!fontFamily) return 'Playfair Display';
  const trimmed = fontFamily.trim();
  if (CARD_FONTS_BY_ID[trimmed]) return trimmed;
  return LEGACY_FONT_FALLBACKS[trimmed] ?? 'Playfair Display';
}

const LEGACY_FONT_FALLBACKS: Record<string, string> = {
  // The humanist and script faces have no bundled TTF, so they map to the two
  // families that can actually be drawn.
  Lora: 'Playfair Display',
  Georgia: 'Playfair Display',
  Parisienne: 'Playfair Display',
  'Alex Brush': 'Playfair Display',
  Tangerine: 'Playfair Display',
  Pacifico: 'Playfair Display',
  Satisfy: 'Playfair Display',
  'Cedarville Cursive': 'Playfair Display',
  'Kaushan Script': 'Playfair Display',
  // The geometric sans faces have no bundled TTF either; DM Sans is the
  // closest available.
  Arial: 'DM Sans',
  Roboto: 'DM Sans',
  Montserrat: 'DM Sans',
  'Open Sans': 'DM Sans',
  Raleway: 'DM Sans',
  Nunito: 'DM Sans',
  Poppins: 'DM Sans',
  monospace: 'DM Sans',
};

export function isCardFontRegularOnly(fontFamily: string): boolean {
  return CARD_FONTS_BY_ID[resolveCardFont(fontFamily)]?.regularOnly ?? false;
}
