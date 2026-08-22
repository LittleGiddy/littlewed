// app/api/auth/check-tenant/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });

    return NextResponse.json({ 
      hasTenant: !!user?.tenantId 
    });
  } catch (error) {
    console.error('Error checking tenant:', error);
    return NextResponse.json(
      { error: 'Failed to check tenant status' },
      { status: 500 }
    );
  }
}