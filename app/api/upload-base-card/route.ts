import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File;
    const eventId = formData.get('eventId') as string;

    if (!file || !eventId) {
      return NextResponse.json({ error: 'Missing image or eventId' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', eventId);
    await mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, 'base-card.png');
    await writeFile(filePath, buffer);
    const url = `/uploads/${eventId}/base-card.png`;
    
    // Redirect back to designer page or return JSON
    return NextResponse.json({ url, message: 'Upload successful' });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}