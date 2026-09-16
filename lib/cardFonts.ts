// lib/cardFonts.ts
// Renders text as true SVG <path> outlines so card generation never depends
// on system fonts being installed on the server. Font outlines come from the
// TTF files copied to public/fonts (see scripts/copy-fonts.js).
import * as opentype from 'opentype.js';
import { readFileSync } from 'node:fs';
import path from 'node:path';

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

// Map the full designer font palette (and the old system-font names) to one
// of the TTF families bundled in public/fonts.
const FAMILY_ALIASES: Record<string, string> = {
  Georgia: 'Playfair Display',
  Lora: 'Playfair Display',
  Parisienne: 'Playfair Display',
  'Alex Brush': 'Playfair Display',
  Tangerine: 'Playfair Display',
  Pacifico: 'Playfair Display',
  Satisfy: 'Playfair Display',
  'Cedarville Cursive': 'Playfair Display',
  'Kaushan Script': 'Playfair Display',
  Arial: 'DM Sans',
  Roboto: 'DM Sans',
  Montserrat: 'DM Sans',
  'Open Sans': 'DM Sans',
  Raleway: 'DM Sans',
  Nunito: 'DM Sans',
  Poppins: 'DM Sans',
  monospace: 'DM Sans',
};

const fontCache = new Map<string, FontPair>();

export function resolveFontFamily(fontFamily: string): string {
  if (FONT_FILES[fontFamily]) return fontFamily;
  return FAMILY_ALIASES[fontFamily] || 'Playfair Display';
}

function fontsFor(family: string): FontPair {
  const cached = fontCache.get(family);
  if (cached) return cached;

  const files = FONT_FILES[family];
  const base = path.join(process.cwd(), 'public', 'fonts');
  const regular = opentype.parse(readFileSync(path.join(base, files.regular)));

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

  const family = resolveFontFamily(options.fontFamily);
  const { bold } = fontsFor(family);
  const emScale = fontSize / bold.unitsPerEm;

  const baselineY = y - ((bold.ascender + bold.descender) / 2) * emScale;
  const advancePass = buildPathData(text, bold, fontSize, emScale, baselineY, 0);

  let startX = x;
  if (textAlign === 'center') startX = x - advancePass.widthPx / 2;
  else if (textAlign === 'right') startX = x - advancePass.widthPx;

  const { d } = buildPathData(text, bold, fontSize, emScale, baselineY, startX);

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