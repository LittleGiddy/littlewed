// app/api/test-whatsapp/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendWhatsAppTemplate } from '@/lib/whatsapp/index';

export async function POST(req: NextRequest) {
  try {
    
    const { phone } = await req.json();

    // ✅ Use hello_world template
    const result = await sendWhatsAppTemplate({
      to: phone,
      template: 'hello_world',
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}