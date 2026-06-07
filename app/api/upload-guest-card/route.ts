import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadToBlob } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenantId = (session.user as any).tenantId;
    const { guestId, base64Image } = await req.json();

    if (!guestId) {
      return NextResponse.json({ error: 'Missing guestId' }, { status: 400 });
    }
    if (!base64Image || typeof base64Image !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid base64Image' }, { status: 400 });
    }

    // Extract the base64 data
    let base64Data = base64Image;
    if (base64Image.includes('base64,')) {
      base64Data = base64Image.split('base64,')[1];
    }

    const buffer = Buffer.from(base64Data, 'base64');
    const key = `guests/${tenantId}/${guestId}.png`;
    const url = await uploadToBlob(key, buffer, 'image/png');

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Upload guest card error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}