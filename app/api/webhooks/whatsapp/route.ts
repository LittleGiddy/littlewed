import { NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN || 'my_secret_verify_token_123';

// ─── GET: Verification handshake ────────────────────────────────────────
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('🔐 Webhook verification request:', { mode, token, challenge });

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully!');
    return new NextResponse(challenge, { status: 200 });
  }

  console.error('❌ Webhook verification failed:', { mode, token });
  return new NextResponse('Verification failed', { status: 403 });
}

// ─── POST: Receive incoming messages ──────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('📨 Webhook payload:', JSON.stringify(body, null, 2));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}