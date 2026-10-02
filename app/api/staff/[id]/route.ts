import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

type StaffUpdate = {
  name?: string;
  email?: string;
  phone?: string | null;
  isActive?: boolean;
  password?: string;
};

/** Edit a staff member, or reset their password. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    const tenantId = (session.user as any).tenantId;

    if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const { id } = await params;
    const body: StaffUpdate = await req.json().catch(() => ({}));

    const staff = await prisma.user.findFirst({
      where: { id, tenantId, role: 'STAFF' },
    });

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    const data: Record<string, unknown> = {};

    if (typeof body.name === 'string' && body.name.trim()) {
      data.name = body.name.trim();
    }

    if (typeof body.email === 'string' && body.email.trim()) {
      const email = body.email.trim().toLowerCase();
      if (email !== staff.email) {
        const taken = await prisma.user.findUnique({ where: { email } });
        if (taken) {
          return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
        }
      }
      data.email = email;
    }

    if (body.phone !== undefined) {
      data.phone = body.phone ? String(body.phone).trim() : null;
    }

    if (typeof body.isActive === 'boolean') {
      data.isActive = body.isActive;
      // Deactivating must also kill the live session, otherwise a suspended
      // staff member stays signed in on their device until it expires.
      if (!body.isActive) data.activeSessionId = null;
    }

    if (typeof body.password === 'string' && body.password) {
      if (body.password.length < 8) {
        return NextResponse.json(
          { error: 'Password must be at least 8 characters' },
          { status: 400 }
        );
      }
      data.password = await bcrypt.hash(body.password, 10);
      // Force a re-login on the old password everywhere.
      data.activeSessionId = null;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        image: true,
        isActive: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('PATCH /api/staff/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ make params a Promise
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    const tenantId = (session.user as any).tenantId;

    if (role !== 'CLIENT' && role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!tenantId) {
      return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
    }

    const { id } = await params; // ✅ await params

    // Verify staff belongs to tenant
    const staff = await prisma.user.findFirst({
      where: { id, tenantId, role: 'STAFF' },
    });

    if (!staff) {
      return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
    }

    await prisma.user.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/staff/[id] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}