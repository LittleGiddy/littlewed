// app/api/auth/check-tenant/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ 
        authenticated: false,
        hasTenant: false,
        isActive: false,
      });
    }

    const userId = (session.user as any).id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        tenantId: true,
        isActive: true,
        role: true,
      },
    });

    console.log('[CheckTenant] User check:', {
      userId,
      hasTenant: !!user?.tenantId,
      isActive: user?.isActive,
    });

    return NextResponse.json({ 
      authenticated: true,
      hasTenant: !!user?.tenantId,
      isActive: user?.isActive ?? false,
      role: user?.role,
    });
  } catch (error) {
    console.error('[CheckTenant] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check tenant status', authenticated: false, hasTenant: false, isActive: false },
      { status: 500 }
    );
  }
}