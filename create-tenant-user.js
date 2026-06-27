// create-tenant-user.js
// Run with: node create-tenant-user.js "Business Name" "subdomain" "email" "password" "Full Name" [phone]

require('dotenv').config(); // ✅ load .env

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 5) {
    console.log(`
Usage: node create-tenant-user.js "Business Name" "subdomain" "email" "password" "Full Name" [phone]

Example:
  node create-tenant-user.js "My Wedding Co." "mywedding" "client@example.com" "securepass123" "Jane Doe" "+255712345678"
`);
    process.exit(1);
  }

  const [business_name, subdomain, email, password, name, phone] = args;

  if (!business_name || !subdomain || !email || !password || !name) {
    console.error('Error: Missing required fields');
    process.exit(1);
  }

  try {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      console.error(`❌ Email "${email}" already registered.`);
      process.exit(1);
    }

    // Check if subdomain is taken
    const existingTenant = await prisma.tenant.findUnique({ where: { subdomain } });
    if (existingTenant) {
      console.error(`❌ Subdomain "${subdomain}" already taken.`);
      process.exit(1);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create tenant and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: business_name,
          subdomain,
          credits: 0,
          simpleEventMode: false,
        },
      });

      const user = await tx.user.create({
        data: {
          name,
          email,
          phone: phone || null,
          password: hashedPassword,
          role: 'CLIENT',
          tenantId: tenant.id,
          emailVerified: new Date(), // skip OTP
          isActive: true,
        },
      });

      return { tenant, user };
    });

    console.log(`
✅ Tenant and user created successfully!

Tenant:
  ID: ${result.tenant.id}
  Name: ${result.tenant.name}
  Subdomain: ${result.tenant.subdomain}

User:
  ID: ${result.user.id}
  Name: ${result.user.name}
  Email: ${result.user.email}
  Role: ${result.user.role}
  Active: ${result.user.isActive}
  Email Verified: ${result.user.emailVerified}
`);
  } catch (error) {
    console.error('❌ Error creating tenant/user:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();