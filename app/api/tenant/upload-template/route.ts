import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // ✅ add this
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions); // ✅ pass authOptions
    console.log('Session in upload-template:', session?.user);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized - No session' }, { status: 401 });
    }

    const role = (session.user as any).role;
    const tenantId = (session.user as any).tenantId;

    if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: `Unauthorized - Role: ${role}` }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('image') as File;
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), 'public', 'tenant-templates', tenantId || 'unknown');
    await mkdir(uploadDir, { recursive: true });
    const fileName = `template-${Date.now()}.png`;
    const filePath = path.join(uploadDir, fileName);
    await writeFile(filePath, buffer);
    const url = `/tenant-templates/${tenantId || 'unknown'}/${fileName}`;

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}