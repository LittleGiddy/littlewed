import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { userId } = await params;

  // Ensure we're not deleting a SUPER_ADMIN
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, tenantId: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (user.role === 'SUPER_ADMIN') {
    return NextResponse.json({ error: 'Cannot delete super admin' }, { status: 403 });
  }

  // Delete the user
  await prisma.user.delete({ where: { id: userId } });

  // If no more users in the tenant, delete the tenant
  if (user.tenantId) {
    const remainingUsers = await prisma.user.count({ where: { tenantId: user.tenantId } });
    if (remainingUsers === 0) {
      await prisma.tenant.delete({ where: { id: user.tenantId } });
    }
  }

  return NextResponse.json({ success: true });
}