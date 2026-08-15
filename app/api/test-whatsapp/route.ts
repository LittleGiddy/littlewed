// app/api/test-whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendHelloWorld } from '@/lib/whatsapp/index';

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const result = await sendHelloWorld(phone);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Test] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send test message' },
      { status: 500 }
    );
  }
}