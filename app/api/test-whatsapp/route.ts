// app/api/test-whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppTemplate } from '@/lib/whatsapp/index';

export async function POST(req: NextRequest) {
  try {
    const { phone } = await req.json();

    if (!phone) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    const result = await sendWhatsAppTemplate({
      to: phone,
      template: 'LittleWed',
      personalisation: [
        {
          "1": "GIDEON FELIX",
          "2": "Mr & Mrs Allan Swai",
          "3": "Agape",
          "4": "Gladness",
          "5": "15 Septemba 2026",
          "6": "Tazara",
          "7": "5:00 PM",
          "8": "1",
          "9": "DOUBLE"
        }
      ],
      header: {
        image: {
          file: 'https://www.gstatic.com/webp/gallery/1.png',
          name: 'Wedding Invitation',
        }
      },
      button: {
        personalisation: {
          url_link: {
            parameters: ['example123']
          }
        }
      }
    });

    // ─── Log the full response ──────────────────────────────────────────
    console.log('[Test] Full response:', JSON.stringify(result, null, 2));

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[Test] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send test message' },
      { status: 500 }
    );
  }
}