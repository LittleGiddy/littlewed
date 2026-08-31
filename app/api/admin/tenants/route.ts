// app/api/admin/tenants/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/authGuard';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

// ─── Prevent static generation ──────────────────────────────────────────
export const dynamic = 'force-dynamic';

// ─── GET (list tenants) ──────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || (session.user as any).role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tenants = await prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        subdomain: true,
        plan: true,
        subscriptionStatus: true,
        credits: true,
        creditsEnabled: true,
        bypassPayment: true,
        testMode: true,
        createdAt: true,
        users: {
          select: { id: true, phone: true },
        },
        // Optionally include event count
        _count: {
          select: {
            events: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Format the response with additional stats
    const formattedTenants = tenants.map(tenant => ({
      ...tenant,
      phone: (tenant.users && tenant.users.find(u => u.phone)?.phone) || null,
      eventsCount: tenant._count.events,
      _count: undefined, // Remove the _count field
    }));

    return NextResponse.json(formattedTenants);
  } catch (error: any) {
    console.error('[Admin Tenants] GET Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to load tenants' },
      { status: 500 }
    );
  }
}

// ─── POST (create tenant) ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - only SUPER_ADMIN can create tenants' },
        { status: 403 }
      );
    }

    const { name, email, password, plan } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Generate subdomain from name
    const subdomain = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // Check if subdomain is taken
    const existing = await prisma.tenant.findUnique({
      where: { subdomain },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Subdomain already taken. Please choose a different name.' },
        { status: 400 }
      );
    }

    // Create tenant with all required fields
    const tenant = await prisma.tenant.create({
      data: {
        name,
        subdomain,
        plan: plan || 'BASIC',
        subscriptionStatus: 'active', // ✅ Default to active
        status: 'ACTIVE',
        maxGuests: 200,
        credits: 0,
        simpleEventMode: false,
        bypassPayment: false,
        testMode: false,
      },
    });

    // Hash password and create user
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name: name,
        role: 'CLIENT',
        tenantId: tenant.id,
        isActive: true, // ✅ Auto-activate the admin user
      },
    });

    return NextResponse.json(
      {
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          subdomain: tenant.subdomain,
          plan: tenant.plan,
          subscriptionStatus: tenant.subscriptionStatus,
        },
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('POST /api/admin/tenants error:', error);

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