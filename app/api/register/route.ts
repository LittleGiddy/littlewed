import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const { business_name, subdomain, email, phone, password, name, emailVerified } = await req.json();

  // Validate required fields
  if (!business_name || !subdomain || !email || !password || !name) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!emailVerified) {
    return NextResponse.json({ error: 'Email must be verified before account creation' }, { status: 400 });
  }

  // Check if email already used
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: 'Email already registered' }, { status: 400 });
  }

  // Check if subdomain taken
  const existingTenant = await prisma.tenant.findUnique({ where: { subdomain } });
  if (existingTenant) {
    return NextResponse.json({ error: 'Subdomain already taken' }, { status: 400 });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create tenant and user in a transaction
  const tenant = await prisma.tenant.create({
    data: {
      name: business_name,
      subdomain,
      credits: 0,
      simpleEventMode: false,
    },
  });

  const user = await prisma.user.create({
    data: {
      name,
      email,
      phone: phone || null, // optional phone
      password: hashedPassword,
      role: 'CLIENT',
      tenantId: tenant.id,
      emailVerified: new Date(),
    },
  });

  return NextResponse.json({ message: 'Account created successfully' });
}