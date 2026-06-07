import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { id } = await params;
    const { amount } = await req.json();
    await prisma.tenant.update({
      where: { id },
      data: { credits: { increment: amount } },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Credit API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}