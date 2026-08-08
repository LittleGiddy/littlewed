// app/api/webhooks/whatsapp/route.ts

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const VERIFY_TOKEN = process.env.WEBHOOK_VERIFY_TOKEN!;
const APP_SECRET = process.env.META_APP_SECRET!;

// ─── Verify signature ──────────────────────────────────────────────────
function verifySignature(body: string, signature: string): boolean {
  if (!APP_SECRET || !signature) return false;
  
  const expectedSignature = crypto
    .createHmac('sha256', APP_SECRET)
    .update(body)
    .digest('hex');
  
  return signature === expectedSignature;
}

// ─── GET: Verification ──────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // ... same as before
}

// ─── POST: Receive messages ────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-hub-signature-256') || '';
    
    // ─── Optional: Verify signature ──────────────────────────────────
    if (APP_SECRET && !verifySignature(body, signature)) {
      console.error('❌ Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);
    console.log('📨 Webhook payload:', JSON.stringify(payload, null, 2));

    // ─── Process messages ────────────────────────────────────────────
    const entry = payload.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (message) {
      console.log(`💬 Message from ${message.from}: ${message.text?.body || 'Media'}`);
      // TODO: Handle incoming message
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}