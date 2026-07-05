import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, email, phone } = await req.json();
  const userId = (session.user as any).id;

  // Check if email is already used by another user
  if (email) {
    const existing = await prisma.user.findFirst({
      where: { email, NOT: { id: userId } },
    });
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name, email, phone },
  });

  return NextResponse.json({ success: true });
}