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
    'Playfair Display': 'Georgia, serif',
    'DM Sans': 'Arial, sans-serif',
    'Roboto': 'Arial, sans-serif',
    'Lora': 'Georgia, serif',
    'Montserrat': 'Arial, sans-serif',
    'Open Sans': 'Arial, sans-serif',
    'Raleway': 'Arial, sans-serif',
    'Nunito': 'Arial, sans-serif',
    'Poppins': 'Arial, sans-serif',
    'Great Vibes': 'Georgia, serif',
    'Parisienne': 'Georgia, serif',
    'Alex Brush': 'Georgia, serif',
    'Tangerine': 'Georgia, serif',
    'Dancing Script': 'Georgia, serif',
    'Pacifico': 'Georgia, serif',
    'Satisfy': 'Georgia, serif',
    'Cedarville Cursive': 'Georgia, serif',
    'Kaushan Script': 'Georgia, serif',
    'Georgia': 'Georgia, serif',
    'monospace': 'monospace, serif',
    'Arial': 'Arial, sans-serif',
  };
  return fontMap[fontFamily] || 'Georgia, serif';
}

/**
 * Render text as image using SVG with system fonts
 * This is the most reliable approach on Vercel
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

  // Create SVG with text using system fonts
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${shadowStyle}
  </defs>
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

  try {
    // Convert SVG to PNG using sharp
    return await sharp(Buffer.from(svg))
      .png()
      .toBuffer();
  } catch (error) {
    console.error('[TextRenderer] Error rendering text:', error);
    // Ultimate fallback - plain text
    const fallbackSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${x}" y="${y}" font-size="${fontSize}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif">
        ${escapeXml(text)}
      </text>
    </svg>`;
    return await sharp(Buffer.from(fallbackSvg)).png().toBuffer();
  }
}