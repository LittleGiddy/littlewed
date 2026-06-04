const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create a tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Little Wed HQ',
      subdomain: 'admin',
      plan: 'ENTERPRISE',
      status: 'ACTIVE',
    },
  });
  console.log('Tenant created:', tenant.id);

  // Link it to your SUPER_ADMIN user
  await prisma.user.update({
    where: { email: 'super@littlewed.com' },
    data: { tenantId: tenant.id },
  });
  console.log('User linked to tenant');
}

main().catch(console.error).finally(() => prisma.$disconnect());