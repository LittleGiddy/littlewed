import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth'; // ✅ add import
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as any).role;
  const tenantId = (session.user as any).tenantId;

  if (!role || (role !== 'CLIENT' && role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden - invalid role' }, { status: 403 });
  }

  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
  }

  const staff = await prisma.user.findMany({
    where: { tenantId, role: 'STAFF' },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      image: true,
      isActive: true,
      createdAt: true,
      // A staff member who has ever signed in has a rotated session id, which
      // is the only "has this person actually used the account" signal stored.
      activeSessionId: true,
      _count: { select: { sessions: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Tenant-wide numbers for the summary widgets, in the same round trip so the
  // page renders in one paint instead of flashing empty tiles.
  const [totalStaff, activeStaff, newThisMonth, eventCount] = await Promise.all([
    prisma.user.count({ where: { tenantId, role: 'STAFF' } }),
    prisma.user.count({ where: { tenantId, role: 'STAFF', isActive: true } }),
    prisma.user.count({
      where: {
        tenantId,
        role: 'STAFF',
        createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
      },
    }),
    prisma.event.count({ where: { tenantId } }),
  ]);

  return NextResponse.json({
    staff: staff.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      image: s.image,
      isActive: s.isActive,
      createdAt: s.createdAt,
      hasSignedIn: Boolean(s.activeSessionId) || s._count.sessions > 0,
    })),
    stats: { totalStaff, activeStaff, newThisMonth, eventCount },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as any).role;
  const tenantId = (session.user as any).tenantId;

  if (!role || (role !== 'CLIENT' && role !== 'SUPER_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden - invalid role' }, { status: 403 });
  }

  if (!tenantId) {
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
  }

  const { email, password, name, phone } = await req.json();
  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  }

  if (String(password).length < 8) {
    return NextResponse.json(
      { error: 'Password must be at least 8 characters' },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashed,
      name,
      phone: phone || null,
      role: 'STAFF',
      tenantId,
      isActive: true,
    },
    select: { id: true, name: true, email: true, phone: true, image: true, isActive: true, createdAt: true },
  });

  return NextResponse.json(user);
}