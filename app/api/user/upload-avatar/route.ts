import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import cloudinary from '@/lib/cloudinary';
import { Readable } from 'stream';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const formData = await req.formData();
    const file = formData.get('avatar') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, WebP, or GIF.' }, { status: 400 });
    }

    if (file.size > 1 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large. Max 1MB.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'avatars',
          public_id: userId,
          format: file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1],
          overwrite: true,
          resource_type: 'image',
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      const readable = new Readable();
      readable._read = () => {};
      readable.push(buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });

    const result = uploadResult as any;

    await prisma.user.update({
      where: { id: userId },
      data: { image: result.secure_url },
    });

    return NextResponse.json({ success: true, avatarUrl: result.secure_url });
  } catch (error) {
    console.error('Upload avatar error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
