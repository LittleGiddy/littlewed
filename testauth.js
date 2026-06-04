const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function test() {
  const user = await prisma.user.findUnique({
    where: { email: 'super@littlewed.com' }
  });

  console.log('User found:', !!user);

  const isValid = await bcrypt.compare('admin123', user.password);
  console.log('Password valid:', isValid);
}

test().catch(console.error).finally(() => prisma.$disconnect());