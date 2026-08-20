// lib/text-renderer.tsx
import sharp from 'sharp';

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Map Google Font names to system fonts available on Vercel
 */
function getSystemFont(fontFamily: string): string {
  const fontMap: Record<string, string> = {
    'Playfair Display': 'Georgia',
    'DM Sans': 'Arial',
    'Roboto': 'Arial',
    'Lora': 'Georgia',
    'Montserrat': 'Arial',
    'Open Sans': 'Arial',
    'Raleway': 'Arial',
    'Nunito': 'Arial',
    'Poppins': 'Arial',
    'Great Vibes': 'Georgia',
    'Parisienne': 'Georgia',
    'Alex Brush': 'Georgia',
    'Tangerine': 'Georgia',
    'Dancing Script': 'Georgia',
    'Pacifico': 'Georgia',
    'Satisfy': 'Georgia',
    'Cedarville Cursive': 'Georgia',
    'Kaushan Script': 'Georgia',
    'Georgia': 'Georgia',
    'monospace': 'monospace',
    'Arial': 'Arial',
  };
  return fontMap[fontFamily] || 'Georgia';
}

/**
 * Render text as SVG with proper styling
 */
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
  const { 
    fontSize, fontFamily, color, align, width, height, x, y, rotation, shadow = true 
  } = options;

  // Get system font fallback
  const systemFont = getSystemFont(fontFamily);
  
  // Map alignment
  const textAnchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const anchorX = align === 'left' ? 0 : align === 'right' ? width : width / 2;
  
  // Build shadow filter
  const shadowStyle = shadow ? `
    <filter id="shadow">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.5"/>
    </filter>
  ` : '';

  // Create SVG with text
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  ${shadowStyle}
  <text
    x="${anchorX}"
    y="${y}"
    font-family="${systemFont}"
    font-size="${fontSize}"
    fill="${color}"
    text-anchor="${textAnchor}"
    dominant-baseline="middle"
    transform="rotate(${rotation}, ${anchorX}, ${y})"
    ${shadow ? 'filter="url(#shadow)"' : ''}
    style="font-weight: bold;"
  >${escapeXml(text)}</text>
</svg>`;

  // Convert SVG to PNG using sharp
  return await sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}