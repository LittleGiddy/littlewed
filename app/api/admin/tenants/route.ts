import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // ✅ import authOptions
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions); // ✅ pass authOptions
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role; // ✅ type cast
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden - only SUPER_ADMIN can create tenants' }, { status: 403 });
    }

    const { name, email, password, plan } = await req.json();

    // Validation
    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate subdomain from name
    const subdomain = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    // Check if subdomain already exists
    const existing = await prisma.tenant.findUnique({
      where: { subdomain },
    });

    if (existing) {
      return NextResponse.json({ error: 'Subdomain already taken' }, { status: 400 });
    }

    // Create tenant (remove schemaName - not in your schema)
    const tenant = await prisma.tenant.create({
      data: {
        name,
        subdomain,
        plan: plan || 'BASIC',
      },
    });

    // Hash password and create admin user
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name,
        role: 'CLIENT',
        tenantId: tenant.id,
      },
    });

    return NextResponse.json(
      { success: true, tenant, user: { id: user.id, email: user.email } },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/tenants error:', error);

    // Handle unique constraint violations
    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0];
      return NextResponse.json(
        { error: `${field} already exists` },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}