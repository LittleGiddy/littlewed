// app/api/test-whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendWeddingInvitation } from '@/lib/whatsapp/index';

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // ─── Send a test wedding invitation ──────────────────────────────────
    const result = await sendWeddingInvitation(phone, {
      guestName: 'Test Guest',
      hostFamily: 'Mr & Mrs Test Family',
      person1: 'Agape',
      person2: 'Gladness',
      date: new Date().toLocaleDateString('sw-TZ', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      venue: 'Test Venue',
      time: '5:00 PM',
      cardNumber: '00001',
      cardType: 'SINGLE',
      imageUrl: 'https://www.gstatic.com/webp/gallery/1.png',
      inviteLink: 'test-invite-123',
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Test] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send test message' },
      { status: 500 }
    );
  }
}