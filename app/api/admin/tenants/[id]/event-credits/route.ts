import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { amount } = await req.json();

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'Invalid credit amount' }, { status: 400 });
  }

  const tenant = await prisma.tenant.update({
    where: { id },
    data: { credits: { increment: amount } },
  });

  return NextResponse.json({ credits: tenant.credits });
}