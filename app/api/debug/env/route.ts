import { NextResponse } from 'next/server';

export async function GET() {
  // Only for debugging – remove after fixing!
  return NextResponse.json({
    hasApiKey: !!process.env.CLICKPESA_API_KEY,
    hasSecret: !!process.env.CLICKPESA_SECRET,
    apiKeyLength: process.env.CLICKPESA_API_KEY?.length || 0,
    secretLength: process.env.CLICKPESA_SECRET?.length || 0,
    baseUrl: process.env.CLICKPESA_BASE_URL || 'not set',
  });
}