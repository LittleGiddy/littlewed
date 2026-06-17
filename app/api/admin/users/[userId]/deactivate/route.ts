import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await params;

  const user = await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
    select: { name: true, email: true },
  });

  // ✅ Create notification for the user
  await prisma.notification.create({
    data: {
      userId,
      title: 'Account Deactivated',
      message: `Your account has been deactivated by an administrator. Please contact support if you believe this is a mistake.`,
      type: 'alert',
    },
  });

  return NextResponse.json(user);
}