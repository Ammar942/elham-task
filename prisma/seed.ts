import { PrismaClient } from '@prisma/client';
import { SEED_SLOTS } from './slots.data';

export async function seedSlots(prisma: PrismaClient): Promise<void> {
  for (const slot of SEED_SLOTS) {
    const data = { startsAt: new Date(slot.startsAt), endsAt: new Date(slot.endsAt) };
    await prisma.slot.upsert({ where: { id: slot.id }, update: data, create: { id: slot.id, ...data } });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedSlots(prisma)
    .then(() => console.log(`Seeded ${SEED_SLOTS.length} slots`))
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
