const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const fixedPpeItems = [
  { itemKey: 'helmet', displayName: 'Helmet' },
  { itemKey: 'vest', displayName: 'Vest' },
  { itemKey: 'gloves', displayName: 'Gloves' },
  { itemKey: 'boots', displayName: 'Boots' },
  { itemKey: 'goggles', displayName: 'Goggles' },
];

async function main() {
  console.log('Seeding fixed PPE items...');

  for (const item of fixedPpeItems) {
    await prisma.ppeItem.upsert({
      where: { itemKey: item.itemKey },
      update: { displayName: item.displayName },
      create: {
        itemKey: item.itemKey,
        displayName: item.displayName,
      },
    });
  }

  // Remove any extra items that are not in the fixed list
  const validKeys = fixedPpeItems.map(i => i.itemKey);
  const extraItems = await prisma.ppeItem.findMany({
    where: {
      itemKey: {
        notIn: validKeys,
      },
    },
  });

  if (extraItems.length > 0) {
    console.log(`Found ${extraItems.length} extra items. Removing...`);
    for (const extra of extraItems) {
      // First remove dependencies to avoid foreign key constraint errors
      await prisma.rolePpeRequirement.deleteMany({ where: { ppeItemId: extra.id } });
      await prisma.detectionDetail.deleteMany({ where: { ppeItemId: extra.id } });
      
      // Then delete the actual PPE item
      await prisma.ppeItem.delete({ where: { id: extra.id } });
      console.log(`Removed: ${extra.itemKey}`);
    }
  }

  console.log('Fixed PPE items seeded successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
