import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { uploadToBlob } from '@/lib/storage';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
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
    const key = `tenants/${tenantId}/template-${Date.now()}.png`;
    const url = await uploadToBlob(key, buffer, file.type);

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}