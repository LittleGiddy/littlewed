import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ authenticated: false, hasTenant: false }, { status: 200 });
  }

  const userId = (session.user as any).id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { tenantId: true, role: true, isActive: true, name: true, email: true },
  });

  return NextResponse.json({
    authenticated: true,
    hasTenant: !!user?.tenantId,
    role: user?.role ?? null,
    isActive: user?.isActive ?? false,
    name: user?.name ?? null,
    email: user?.email ?? null,
  });
}