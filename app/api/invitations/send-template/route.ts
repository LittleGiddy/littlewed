// app/api/test-whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendHelloWorld, sendSimpleTestMessage, sendWeddingInvitation } from '@/lib/whatsapp/index';

export async function POST(req: NextRequest) {
  try {
    const { phone, type } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    let result;

    switch (type) {
      case 'wedding':
        // ✅ Remove imageUrl
        result = await sendWeddingInvitation(phone, {
          name: 'GIDEON FELIX',
          hostFamily: 'Mr & Mrs Allan Swai',
          person1: 'Agape',
          person2: 'Gladness',
          date: '15 Septemba 2026',
          venue: 'Tazara',
          time: '5:00 PM',
          cardNumber: '108',
          cardType: 'SINGLE',
          // ❌ imageUrl removed
          inviteLink: 'example123',
        });
        break;

      case 'simple':
        result = await sendSimpleTestMessage(phone, {
          name: 'GIDEON FELIX',
          cardNumber: '108',
        });
        break;

      default:
        result = await sendHelloWorld(phone);
        break;
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Test] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send test message' },
      { status: 500 }
    );
  }
}