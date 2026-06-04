// scripts/create-super-admin.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { email: 'super@littlewed.com' },
    update: {},
    create: {
      email: 'super@littlewed.com',
      password: hashed,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
    },
  });
  console.log('Super admin created: super@littlewed.com / admin123');
}
main();