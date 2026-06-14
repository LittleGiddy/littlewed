const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Update all guests that have no routingChannel (null) to 'sms'
  const updated = await prisma.guest.updateMany({
    where: { routingChannel: null },
    data: { routingChannel: 'sms' },
  });
  console.log(`Updated ${updated.count} guests to 'sms'.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());