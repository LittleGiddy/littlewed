import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // ✅ add import
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
  const session = await getServerSession(authOptions); // ✅ pass authOptions
  console.log('=== GET /api/staff ===');
  console.log('Session exists?', !!session);
  if (session) {
    console.log('User:', session.user);
    console.log('Role:', (session.user as any).role);
    console.log('TenantId:', (session.user as any).tenantId);
  }

  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as any).role;
  const tenantId = (session.user as any).tenantId;

  if (!role || (role !== 'CLIENT' && role !== 'SUPER_ADMIN')) {
    console.log(`Role mismatch: ${role}`);
    return NextResponse.json({ error: 'Forbidden - invalid role' }, { status: 403 });
  }

  if (!tenantId) {
    console.log('Missing tenantId');
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
  }

  const staff = await prisma.user.findMany({
    where: { tenantId, role: 'STAFF' },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions); // ✅ pass authOptions
  console.log('=== POST /api/staff ===');
  console.log('Session exists?', !!session);
  if (session) {
    console.log('User:', session.user);
    console.log('Role:', (session.user as any).role);
    console.log('TenantId:', (session.user as any).tenantId);
  }

  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as any).role;
  const tenantId = (session.user as any).tenantId;

  if (!role || (role !== 'CLIENT' && role !== 'SUPER_ADMIN')) {
    console.log(`Role mismatch: ${role}`);
    return NextResponse.json({ error: 'Forbidden - invalid role' }, { status: 403 });
  }

  if (!tenantId) {
    console.log('Missing tenantId');
    return NextResponse.json({ error: 'Missing tenant context' }, { status: 400 });
  }

  const { email, password, name } = await req.json();
  if (!email || !password || !name) {
    return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
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
      role: 'STAFF',
      tenantId,
    },
  });

  return NextResponse.json(user);
}