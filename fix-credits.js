const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CREDIT_COST = 300;

async function main() {
  // Find all pending credit purchases
  const transactions = await prisma.transaction.findMany({
    where: {
      type: 'CREDIT_PURCHASE',
      status: 'PENDING',
    },
  });

  console.log(`Found ${transactions.length} pending credit purchases.`);

  for (const t of transactions) {
    const creditsToAdd = Math.floor(t.amount / CREDIT_COST);
    if (creditsToAdd <= 0) continue;

    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: t.id },
        data: { status: 'COMPLETED' },
      }),
      prisma.tenant.update({
        where: { id: t.tenantId },
        data: { credits: { increment: creditsToAdd } },
      }),
    ]);

    console.log(`✅ Added ${creditsToAdd} credits to tenant ${t.tenantId} (transaction ${t.id})`);
  }

  console.log('Done.');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());