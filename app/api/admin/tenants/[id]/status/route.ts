// app/api/admin/tenants/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const { status } = await req.json();

    if (!status || !['active', 'inactive'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "active" or "inactive"' },
        { status: 400 }
      );
    }

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: { id: true },
        },
      },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Update tenant status
    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: { subscriptionStatus: status },
      include: {
        users: {
          select: { id: true },
        },
      },
    });

    // Activate or deactivate all users under this tenant
    if (status === 'inactive') {
      await prisma.user.updateMany({
        where: { tenantId: id },
        data: { isActive: false },
      });
    } else {
      await prisma.user.updateMany({
        where: { tenantId: id },
        data: { isActive: true },
      });
    }

    return NextResponse.json({
      success: true,
      tenant: {
        id: updatedTenant.id,
        name: updatedTenant.name,
        subdomain: updatedTenant.subdomain,
        subscriptionStatus: updatedTenant.subscriptionStatus,
        usersCount: updatedTenant.users.length,
      },
    });
  } catch (error: any) {
    console.error('[Admin Tenants] PATCH Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to update tenant status' },
      { status: 500 }
    );
  }
}