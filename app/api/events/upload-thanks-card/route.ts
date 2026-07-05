import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('image') as File;
  const eventId = formData.get('eventId') as string;

  if (!file || !eventId) {
    return NextResponse.json({ error: 'Missing file or eventId' }, { status: 400 });
  }

  // Ensure the upload directory exists
  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'thanks', eventId);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const timestamp = Date.now();
  const ext = path.extname(file.name) || '.png';
  const filename = `thanks-${timestamp}${ext}`;
  const filePath = path.join(uploadDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(filePath, buffer);

  const publicUrl = `/uploads/thanks/${eventId}/${filename}`;

  // Update the event with the thanks card URL
  await prisma.event.update({
    where: { id: eventId },
    data: { thankYouCardUrl: publicUrl },
  });

  return NextResponse.json({ url: publicUrl });
}