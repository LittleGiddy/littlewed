// app/api/auth/check-tenant/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    console.log('[CheckTenant] Session:', session?.user?.email);
    
    if (!session || !session.user) {
      return NextResponse.json({ 
        hasTenant: false,
        error: 'Unauthorized' 
      }, { status: 401 });
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

    console.log('[CheckTenant] User found:', {
      userId,
      hasTenant: !!user?.tenantId,
      isActive: user?.isActive,
      role: user?.role,
    });

    // If user is not active, they shouldn't be able to access the dashboard
    if (!user?.isActive) {
      return NextResponse.json({ 
        hasTenant: false,
        isActive: false,
        message: 'Account is pending activation. Please contact support.'
      });
    }

    return NextResponse.json({ 
      hasTenant: !!user?.tenantId,
      isActive: user?.isActive,
      role: user?.role,
    });
  } catch (error) {
    console.error('[CheckTenant] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check tenant status', hasTenant: false },
      { status: 500 }
    );
  }
}