const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash('test123', 10);
  const user = await prisma.user.upsert({
    where: { email: 'test@littlewed.com' },
    update: {},
    create: {
      email: 'test@littlewed.com',
      password: hashedPassword,
      name: 'Test User',
      role: 'admin',
    },
  });
  console.log('User created:', user);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());