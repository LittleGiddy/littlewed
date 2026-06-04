const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const hashedPassword = await bcrypt.hash('password123', 10)
  
  const user = await prisma.user.create({
    data: {
      email: 'admin@littlewed.com',
      password: hashedPassword,
      name: 'Admin User',
      role: 'admin'
    }
  })
  
  console.log('✅ User created:', user.email)
  console.log('🔑 Password: password123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())