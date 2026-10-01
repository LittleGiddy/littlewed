// lib/cardFonts.ts
// Renders text as true SVG <path> outlines so card generation never depends
// on system fonts being installed on the server. Font outlines come from the
// TTF files copied to public/fonts (see scripts/copy-fonts.js).
//
// The font palette itself lives in lib/card-fonts.shared.ts so the browser
// designer offers exactly the faces that can be rendered here.
import * as opentype from 'opentype.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isCardFontRegularOnly, resolveCardFont } from './card-fonts.shared';

interface FontPair {
  regular: opentype.Font;
  bold: opentype.Font;
}

const FONT_FILES: Record<string, { regular: string; bold?: string }> = {
  'Playfair Display': { regular: 'PlayfairDisplay-Regular.ttf', bold: 'PlayfairDisplay-Bold.ttf' },
  'DM Sans': { regular: 'DMSans-Regular.ttf', bold: 'DMSans-Bold.ttf' },
  'Dancing Script': { regular: 'DancingScript-Regular.ttf', bold: 'DancingScript-Bold.ttf' },
  'Great Vibes': { regular: 'GreatVibes-Regular.ttf' },
};

const fontCache = new Map<string, FontPair>();

export function resolveFontFamily(fontFamily: string): string {
  return resolveCardFont(fontFamily);
}

function fontsFor(family: string): FontPair {
  const cached = fontCache.get(family);
  if (cached) return cached;

  const files = FONT_FILES[family];
  const base = path.join(process.cwd(), 'public', 'fonts');
  const regular = opentype.parse(readFileSync(path.join(base, files.regular)));

  // A family with only one weight reuses its regular outlines as the "bold" so
  // there is no synthetic emboldening. The designer mirrors this by not asking
  // for bold weight in the browser for those faces.
  let bold: opentype.Font = regular;
  if (files.bold) {
    try {
      bold = opentype.parse(readFileSync(path.join(base, files.bold)));
    } catch {
      bold = regular;
    }
  }

  const pair: FontPair = { regular, bold };
  fontCache.set(family, pair);
  return pair;
}

/** The outlines actually used to draw card text. */
function faceFor(family: string): opentype.Font {
  const { regular, bold } = fontsFor(family);
  return isCardFontRegularOnly(family) ? regular : bold;
}

export interface TextSvgOptions {
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  x: number;
  y: number;
  rotation?: number;
  shadow?: boolean;
  textAlign?: 'left' | 'center' | 'right';
  width?: number;
  height?: number;
}

function buildPathData(
  text: string,
  font: opentype.Font,
  fontSize: number,
  emScale: number,
  baselineY: number,
  cursorStart: number
): { d: string; widthPx: number } {
  let d = '';
  let cursor = cursorStart;
  let total = 0;

  const spaceAdvance =
    (font.glyphs.get(font.charToGlyphIndex(' '))?.advanceWidth ?? 0) * emScale;

  for (const ch of text) {
    if (font.charToGlyphIndex(ch) > 0) {
      const advance =
        (font.glyphs.get(font.charToGlyphIndex(ch))?.advanceWidth ?? 0) * emScale;
      if (ch !== ' ') {
        d += font.getPath(ch, cursor, baselineY, fontSize).toPathData(2);
      }
      cursor += advance;
      total += advance;
    } else {
      cursor += spaceAdvance;
      total += spaceAdvance;
    }
  }

  return { d, widthPx: total };
}

export function textSvg(options: TextSvgOptions): string {
  const {
    text,
    fontSize,
    color,
    x,
    y,
    rotation = 0,
    shadow = false,
    textAlign = 'left',
    width = 100,
    height = 100,
  } = options;

  if (!text.trim()) {
    // An empty string still produces a valid, fully transparent SVG so callers
    // can composite unconditionally.
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"/>`;
  }

  const family = resolveFontFamily(options.fontFamily);
  const face = faceFor(family);
  const emScale = fontSize / face.unitsPerEm;

  const baselineY = y + ((face.ascender + face.descender) / 2) * emScale;
  const advancePass = buildPathData(text, face, fontSize, emScale, baselineY, 0);

  let startX = x;
  if (textAlign === 'center') startX = x - advancePass.widthPx / 2;
  else if (textAlign === 'right') startX = x - advancePass.widthPx;

  const { d } = buildPathData(text, face, fontSize, emScale, baselineY, startX);

  const shadowFilter = shadow
    ? `<filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.5"/></filter>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${shadowFilter}
  </defs>
  <g transform="rotate(${rotation}, ${x}, ${y})" ${shadow ? 'filter="url(#shadow)"' : ''}>
    <path d="${d}" fill="${color}"/>
  </g>
</svg>`;
}

/**
 * Vertical offset from a text's centre to its baseline, in em.
 *
 * `y` is the anchor point a designer drags, and both the designer and this
 * renderer treat it as the visual centre of the text. A baseline sits below
 * that centre by half the difference between the ascent and the descent, so
 * converting "centre" to "baseline" means adding this.
 *
 * The browser derives the same value from the font's own metrics: with a
 * line-height of `L`, half-leading is `(L - (ascender + |descender|)) / 2` and
 * the baseline sits at `halfLeading + ascender`, so the centre-to-baseline
 * distance is `(ascender - |descender|) / 2` — the same expression below. The
 * designer relies on that equivalence, so this is the one place the sign has to
 * be right.
 */
export function baselineOffsetEm(fontFamily: string): number {
  const face = faceFor(resolveFontFamily(fontFamily));
  return (face.ascender + face.descender) / 2 / face.unitsPerEm;
}