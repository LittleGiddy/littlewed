// app/api/test-text/route.ts
import { NextResponse } from 'next/server';
import sharp from 'sharp';

export async function GET() {
  const svg = `
    <svg width="200" height="100">
      <text x="100" y="50" font-family="Georgia" font-size="24" fill="black" text-anchor="middle">
        Hello World
      </text>
    </svg>
  `;

  const buffer = await sharp(Buffer.from(svg))
    .png()
    .toBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'image/png',
    },
  });
}