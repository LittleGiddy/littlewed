// scripts/generate-all-card-images.ts
import { prisma } from '../lib/prisma';
import { generateAndStoreCardForGuest } from '../lib/image-storage';

async function generateAllCardImages() {
  console.log('🔄 Generating card images for all guests...');

  const guests = await prisma.guest.findMany({
    where: {
      passCode: { not: null },
      invitationCard: null,
    },
  });

  console.log(`📊 Found ${guests.length} guests without card images`);

  let success = 0;
  let failed = 0;

  for (const guest of guests) {
    try {
      await generateAndStoreCardForGuest(guest.id);
      console.log(`✅ ${guest.name} (${guest.id})`);
      success++;
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 500));
    } catch (error) {
      console.error(`❌ ${guest.name} (${guest.id}):`, error);
      failed++;
    }
  }

  console.log(`\n🎉 Done! Success: ${success}, Failed: ${failed}`);
}

generateAllCardImages()
  .catch(console.error)
  .finally(() => process.exit());