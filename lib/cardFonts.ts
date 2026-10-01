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

/** Advance width of one character, in px. A character with no glyph in the face
 *  advances like a space, which is what the browser does with `.notdef`. */
function advanceFor(ch: string, font: opentype.Font, emScale: number, spaceAdvance: number): number {
  const index = font.charToGlyphIndex(ch);
  if (index <= 0) return spaceAdvance;
  return (font.glyphs.get(index)?.advanceWidth ?? 0) * emScale;
}

function spaceAdvanceFor(font: opentype.Font, emScale: number): number {
  return (font.glyphs.get(font.charToGlyphIndex(' '))?.advanceWidth ?? 0) * emScale;
}

/**
 * Width of a whole run, in px: the running sum of its glyph advances.
 *
 * This is the single measurement both `textAlign: 'center'` and `'right'` are
 * anchored against, and it is deliberately the *naive* sum rather than a shaped
 * one. The browser designer turns kerning and ligatures off for this text (see
 * ReminderCardDesigner), so its inline box measures the same run the same way.
 * Any divergence between the two shows up as a name that is off-centre on the
 * delivered card relative to the position the tenant dragged it to.
 */
export function measureTextRun(text: string, font: opentype.Font, fontSize: number): number {
  const emScale = fontSize / font.unitsPerEm;
  const spaceAdvance = spaceAdvanceFor(font, emScale);
  let total = 0;
  for (const ch of text) total += advanceFor(ch, font, emScale, spaceAdvance);
  return total;
}

/** The same run, emitted as one `<path>` starting at `cursorStart`. */
function buildPathData(
  text: string,
  font: opentype.Font,
  fontSize: number,
  emScale: number,
  baselineY: number,
  cursorStart: number
): string {
  let d = '';
  let cursor = cursorStart;
  const spaceAdvance = spaceAdvanceFor(font, emScale);

  for (const ch of text) {
    // Spaces advance the cursor but contribute no outline.
    if (ch !== ' ' && font.charToGlyphIndex(ch) > 0) {
      d += font.getPath(ch, cursor, baselineY, fontSize).toPathData(2);
    }
    cursor += advanceFor(ch, font, emScale, spaceAdvance);
  }

  return d;
}

export function textSvg(options: TextSvgOptions): string {
  const {
    text: rawText,
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

  // Leading/trailing whitespace is trimmed rather than measured. CSS collapses
  // it at the edges of a line box, so a name typed with a stray trailing space
  // measures narrower in the designer than it does here - which would drag a
  // centred name sideways by half a space on the delivered card.
  const text = rawText.trim();

  if (!text) {
    // An empty string still produces a valid, fully transparent SVG so callers
    // can composite unconditionally.
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"/>`;
  }

  const family = resolveFontFamily(options.fontFamily);
  const face = faceFor(family);

  // The anchor is the text's visual centre, so the baseline sits half the
  // ascent/descent difference below it. `baselineOffsetEm` is the same
  // expression the browser derives from its own metrics.
  const baselineY = y + baselineOffsetEm(family) * fontSize;

  const runWidth = measureTextRun(text, face, fontSize);
  let startX = x;
  if (textAlign === 'center') startX = x - runWidth / 2;
  else if (textAlign === 'right') startX = x - runWidth;

  const d = buildPathData(text, face, fontSize, fontSize / face.unitsPerEm, baselineY, startX);

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