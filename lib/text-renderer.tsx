// lib/text-renderer.tsx
import { ImageResponse } from '@vercel/og';
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
 * Render text as PNG using @vercel/og
 * This works on Vercel because it's built for it
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

  // Map alignment
  const justifyContent = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';
  const textAlign = align === 'left' ? 'left' : align === 'right' ? 'right' : 'center';

  try {
    // Use @vercel/og to render text
    const response = new ImageResponse(
      (
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
        </div>
      ),
      {
        width: width,
        height: height,
      }
    );

    // Convert the response to buffer
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    console.error('[TextRenderer] @vercel/og error:', error);
    // Fallback: Create a simple SVG with basic fonts
    const fallbackSvg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text x="${x}" y="${y}" font-size="${fontSize}" fill="${color}" text-anchor="middle" dominant-baseline="middle" font-family="Arial, sans-serif">
        ${escapeXml(text)}
      </text>
    </svg>`;
    return await sharp(Buffer.from(fallbackSvg)).png().toBuffer();
  }
}