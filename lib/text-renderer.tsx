// lib/text-renderer.tsx
import satori from 'satori';
import sharp from 'sharp';
import { readFileSync } from 'fs';
import path from 'path';

// ─── Type definitions for Satori fonts ──────────────────────────────────
type FontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
type FontStyle = 'normal' | 'italic';

interface FontData {
  data: Buffer;
  weight: FontWeight;
  style: FontStyle;
}

// ─── Load font files ─────────────────────────────────────────────────────
let fontsLoaded = false;
let fontData: Record<string, Buffer> = {};

function loadFonts(): Record<string, Buffer> {
  if (fontsLoaded) return fontData;

  // ─── ALL 19 fonts from the designer ──────────────────────────────────────
  const fontPaths: Record<string, string> = {
    'PlayfairDisplay': 'public/fonts/PlayfairDisplay.woff2',
    'DMSans': 'public/fonts/DMSans.woff2',
    'Roboto': 'public/fonts/Roboto.woff2',
    'Lora': 'public/fonts/Lora.woff2',
    'Montserrat': 'public/fonts/Montserrat.woff2',
    'OpenSans': 'public/fonts/OpenSans.woff2',
    'Raleway': 'public/fonts/Raleway.woff2',
    'Nunito': 'public/fonts/Nunito.woff2',
    'Poppins': 'public/fonts/Poppins.woff2',
    'GreatVibes': 'public/fonts/GreatVibes.woff2',
    'Parisienne': 'public/fonts/Parisienne.woff2',
    'AlexBrush': 'public/fonts/AlexBrush.woff2',
    'Tangerine': 'public/fonts/Tangerine.woff2',
    'DancingScript': 'public/fonts/DancingScript.woff2',
    'Pacifico': 'public/fonts/Pacifico.woff2',
    'Satisfy': 'public/fonts/Satisfy.woff2',
    'CedarvilleCursive': 'public/fonts/CedarvilleCursive.woff2',
    'KaushanScript': 'public/fonts/KaushanScript.woff2',
  };

  const fontDataMap: Record<string, Buffer> = {};
  
  for (const [name, filePath] of Object.entries(fontPaths)) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      const fs = require('fs');
      if (fs.existsSync(fullPath)) {
        fontDataMap[name] = readFileSync(fullPath);
        console.log(`[Fonts] Loaded ${name} from ${filePath}`);
      } else {
        console.warn(`[Fonts] Font file not found: ${filePath}`);
      }
    } catch (error) {
      console.warn(`[Fonts] Could not load ${name} from ${filePath}`);
    }
  }

  fontData = fontDataMap;
  fontsLoaded = true;
  return fontData;
}

// ─── Map font family to font data with proper types ──────────────────────
function getFontsForFamily(family: string): FontData[] {
  const fonts = loadFonts();
  const results: FontData[] = [];

  // ─── Complete map of ALL 19 fonts ──────────────────────────────────────
  const familyMap: Record<string, string[]> = {
    'Playfair Display': ['PlayfairDisplay'],
    'DM Sans': ['DMSans'],
    'Roboto': ['Roboto'],
    'Lora': ['Lora'],
    'Montserrat': ['Montserrat'],
    'Open Sans': ['OpenSans'],
    'Raleway': ['Raleway'],
    'Nunito': ['Nunito'],
    'Poppins': ['Poppins'],
    'Great Vibes': ['GreatVibes'],
    'Parisienne': ['Parisienne'],
    'Alex Brush': ['AlexBrush'],
    'Tangerine': ['Tangerine'],
    'Dancing Script': ['DancingScript'],
    'Pacifico': ['Pacifico'],
    'Satisfy': ['Satisfy'],
    'Cedarville Cursive': ['CedarvilleCursive'],
    'Kaushan Script': ['KaushanScript'],
    'Georgia': ['PlayfairDisplay'], // Fallback for Georgia
  };

  const fontNames = familyMap[family] || ['DMSans'];
  
  for (const name of fontNames) {
    const data = fonts[name];
    if (data) {
      results.push({ 
        data, 
        weight: 400 as FontWeight, 
        style: 'normal' as FontStyle 
      });
    }
  }

  // Fallback to any available font
  if (results.length === 0) {
    const firstFont = Object.values(fonts)[0];
    if (firstFont) {
      results.push({ 
        data: firstFont, 
        weight: 400 as FontWeight, 
        style: 'normal' as FontStyle 
      });
    }
  }

  return results;
}

// ─── Render text as SVG using Satori ────────────────────────────────────
export async function renderTextToSvg(
  text: string,
  options: {
    fontSize: number;
    fontFamily: string;
    color: string;
    align: 'left' | 'center' | 'right';
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
    shadow?: boolean;
  }
): Promise<Buffer> {
  const { 
    fontSize, fontFamily, color, align, width, height, x, y, rotation, shadow = true 
  } = options;

  // Get font data with proper types
  const fontData = getFontsForFamily(fontFamily);

  if (fontData.length === 0) {
    console.warn(`[TextRenderer] No font found for ${fontFamily}, using fallback`);
    // Create a simple SVG fallback
    const fallbackSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${x}" y="${y}" font-size="${fontSize}" fill="${color}" text-anchor="middle" dominant-baseline="middle">
        ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </text>
    </svg>`;
    return Buffer.from(fallbackSvg);
  }

  // Map alignment
  const justifyContent = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  const textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';

  // Create the SVG using Satori
  try {
    const svg = await satori(
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: justifyContent,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: `${x}px ${y}px`,
        }}
      >
        <div
          style={{
            fontSize: `${fontSize}px`,
            fontFamily: fontFamily,
            color: color,
            fontWeight: 700,
            textShadow: shadow ? '2px 2px 8px rgba(0,0,0,0.5)' : 'none',
            padding: '0 20px',
            textAlign: textAlign as any,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: justifyContent,
          }}
        >
          {text}
        </div>
      </div>,
      {
        width,
        height,
        fonts: fontData.map(f => ({
          name: fontFamily,
          data: f.data,
          weight: f.weight,
          style: f.style,
        })),
      }
    );

    return Buffer.from(svg);
  } catch (error) {
    console.error('[TextRenderer] Satori error:', error);
    // Fallback to simple SVG
    const fallbackSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${x}" y="${y}" font-size="${fontSize}" fill="${color}" text-anchor="middle" dominant-baseline="middle">
        ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </text>
    </svg>`;
    return Buffer.from(fallbackSvg);
  }
}

// ─── Render text as PNG image (for compositing) ────────────────────────
export async function renderTextToImage(
  text: string,
  options: {
    fontSize: number;
    fontFamily: string;
    color: string;
    align: 'left' | 'center' | 'right';
    width: number;
    height: number;
    x: number;
    y: number;
    rotation: number;
    shadow?: boolean;
  }
): Promise<Buffer> {
  try {
    const svgBuffer = await renderTextToSvg(text, options);
    // Convert SVG to PNG
    const imageBuffer = await sharp(svgBuffer)
      .png()
      .toBuffer();
    return imageBuffer;
  } catch (error) {
    console.error('[TextRenderer] Failed to render text:', error);
    // Return a blank image as fallback
    const fallbackSvg = `<svg width="${options.width}" height="${options.height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${options.x}" y="${options.y}" font-size="${options.fontSize}" fill="${options.color}" text-anchor="middle" dominant-baseline="middle">
        ${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </text>
    </svg>`;
    return await sharp(Buffer.from(fallbackSvg)).png().toBuffer();
  }
}