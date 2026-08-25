// app/api/register/complete-google/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { business_name, subdomain } = await req.json();

    if (!business_name || !subdomain) {
      return NextResponse.json(
        { error: 'Business name and subdomain are required' },
        { status: 400 }
      );
    }

    const userId = (session.user as any).id;

    // Check if user already has a tenant
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { tenantId: true },
    });

    if (existingUser?.tenantId) {
      return NextResponse.json(
        { error: 'You already have an organization' },
        { status: 400 }
      );
    }

    // Check if subdomain is already taken
    const existingTenant = await prisma.tenant.findUnique({
      where: { subdomain },
    });

    if (existingTenant) {
      return NextResponse.json(
        { error: 'Subdomain is already taken. Please choose another.' },
        { status: 409 }
      );
    }

    // Create the tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: business_name,
        subdomain,
        plan: 'BASIC',
        status: 'ACTIVE',
        subscriptionStatus: 'active',
        maxGuests: 200,
        credits: 0,
        simpleEventMode: false,
        bypassPayment: false,
        testMode: false,
      },
    });

    // Update the user with tenantId
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        tenantId: tenant.id,
        role: 'CLIENT',
        // isActive should remain as is (super admin needs to activate)
      },
    });

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
      },
    });

  } catch (error: any) {
    console.error('[CompleteGoogleSignup] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete signup' },
      { status: 500 }
    );
  }
}