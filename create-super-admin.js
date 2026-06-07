// Run this in a Node script (create-super-admin.js) with production DATABASE_URL
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  // Delete existing
  await prisma.user.deleteMany({ where: { email: 'super@littlewed.com' } });
  const hashed = await bcrypt.hash('admin123', 10);
  const user = await prisma.user.create({
    data: {
      email: 'super@littlewed.com',
      password: hashed,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  });
  console.log('Re‑created super admin:', user.email);
}
main().catch(console.error).finally(() => prisma.$disconnect());