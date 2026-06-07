import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession();
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  const { amount } = await req.json();
  await prisma.tenant.update({
    where: { id },
    data: { credits: { increment: amount } }, // ✅ use 'credits' not 'creditBalance'
  });
  return NextResponse.json({ success: true });
}