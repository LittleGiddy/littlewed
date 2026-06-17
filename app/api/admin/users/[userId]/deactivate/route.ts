import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  
  // Log session for debugging
  console.log('Session in deactivate route:', session);
  console.log('User role:', (session?.user as any)?.role);

  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await params;

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    select: { name: true, email: true },
  });

  return NextResponse.json(user);
}