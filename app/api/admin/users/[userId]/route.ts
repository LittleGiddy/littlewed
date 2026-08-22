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
      include: {
        tenant: {
          select: {
            id: true,
          },
        },
        // Count related records using separate queries
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.role === 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Cannot delete super admin' }, { status: 403 });
    }

    // Get counts of related records for logging and confirmation
    const [notificationCount, accountCount, sessionCount, guestCount, eventCount] = await Promise.all([
      prisma.notification.count({ where: { userId } }),
      prisma.account.count({ where: { userId } }),
      prisma.session.count({ where: { userId } }),
      prisma.guest.count({ where: { event: { tenantId: user.tenantId || undefined } } }),
      prisma.event.count({ where: { tenantId: user.tenantId || undefined } }),
    ]);

    // Log what will be deleted (optional but helpful for auditing)
    console.log(`Deleting user ${userId} (${user.name}) with:`, {
      notifications: notificationCount,
      accounts: accountCount,
      sessions: sessionCount,
      guests: guestCount,
      events: eventCount,
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
      message: 'User and all related records deleted successfully',
      details: {
        userId,
        userName: user.name,
        deleted: {
          notifications: notificationCount,
          accounts: accountCount,
          sessions: sessionCount,
          guests: guestCount,
          events: eventCount,
        }
      }
    });

  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete user' },
      { status: 500 }
    );
  }
}