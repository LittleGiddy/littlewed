// app/api/auth/complete-signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Get the session to ensure the user is authenticated
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { businessName, subdomain } = await req.json();

    if (!businessName || !subdomain) {
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

    // Create the Tenant with all required fields
    const tenant = await prisma.tenant.create({
      data: {
        name: businessName,
        subdomain,
        plan: 'BASIC',
        status: 'ACTIVE',
        subscriptionStatus: 'active', // ✅ Changed from 'inactive' to 'active'
        maxGuests: 200,
        credits: 0,
        // ✅ Add default values for other fields if they're required
        simpleEventMode: false,
        bypassPayment: false,
        testMode: false,
      },
    });

    // Update the User with tenantId and set role to CLIENT
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        tenantId: tenant.id,
        role: 'CLIENT',
        isActive: true, // ✅ Activate the user
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
      },
    });
  } catch (error) {
    console.error('Complete signup error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}