import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { business_name, subdomain, email, password, name } = await req.json();

  if (!business_name || !subdomain || !email || !password || !name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
  }

  const existingTenant = await prisma.tenant.findUnique({ where: { subdomain } });
  if (existingTenant) {
    return NextResponse.json({ error: 'Subdomain already taken' }, { status: 400 });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const tenant = await prisma.tenant.create({
    data: {
      name: business_name,
      subdomain,
      subscriptionStatus: 'active',
      maxGuests: 200,
      credits: 0, // ✅ changed from creditBalance to credits
    },
  });

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role: 'CLIENT',
      tenantId: tenant.id,
    },
  });

  return NextResponse.json({ success: true, tenantId: tenant.id });
}