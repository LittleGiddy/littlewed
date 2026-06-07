import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { put } from '@vercel/blob';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'CLIENT') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const formData = await req.formData();
  const file = formData.get('image') as File;
  const eventId = formData.get('eventId') as string;
  if (!file || !eventId) {
    return NextResponse.json({ error: 'Missing file or eventId' }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `events/${eventId}/card-${Date.now()}.png`;
  // Store the file in Vercel Blob with public access[reference:3]
  const blob = await put(key, buffer, {
    access: 'public',
    contentType: file.type,
  });
  return NextResponse.json({ url: blob.url });
}