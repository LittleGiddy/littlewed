import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Received body keys:', Object.keys(body));
    console.log('guestId:', body.guestId);
    console.log('base64Image length:', body.base64Image?.length);

    const { guestId, base64Image } = body;

    if (!guestId) {
      return NextResponse.json({ error: 'Missing guestId' }, { status: 400 });
    }
    if (!base64Image || typeof base64Image !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid base64Image' }, { status: 400 });
    }

    // Extract the base64 data (remove prefix if present)
    let base64Data = base64Image;
    if (base64Image.includes('base64,')) {
      base64Data = base64Image.split('base64,')[1];
    }

    const buffer = Buffer.from(base64Data, 'base64');
    console.log('Buffer size:', buffer.length);

    const uploadDir = path.join(process.cwd(), 'public', 'invitations');
    await mkdir(uploadDir, { recursive: true });
    const fileName = `${guestId}.png`;
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);

    const url = `/invitations/${fileName}`;
    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Upload guest card error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}