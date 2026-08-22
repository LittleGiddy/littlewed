// app/api/admin/users/[userId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId } = await params;

    // Check if user exists and is not super admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        role: true, 
        tenantId: true,
        // Include counts to know what will be deleted
        _count: {
          select: {
            notifications: true,
            accounts: true,
            sessions: true,
            events: true,
            guests: true,
          }
        }
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot delete super admin' }, { status: 403 });
    }

    // Log what will be deleted (optional but helpful for auditing)
    console.log(`Deleting user ${userId} with:`, {
      notifications: user._count.notifications,
      accounts: user._count.accounts,
      sessions: user._count.sessions,
      events: user._count.events,
      guests: user._count.guests,
    });

    // With cascading deletes, this will automatically delete all related records
    await prisma.user.delete({
      where: { id: userId },
    });

    // Delete tenant if no users remain
    if (user.tenantId) {
      const remainingUsers = await prisma.user.count({
        where: { tenantId: user.tenantId },
      });
      
      if (remainingUsers === 0) {
        // With cascading deletes, this will delete all events, guests, etc.
        await prisma.tenant.delete({
          where: { id: user.tenantId },
        });
        console.log(`Deleted tenant ${user.tenantId} (no users remaining)`);
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'User and all related records deleted successfully'
    });

  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}