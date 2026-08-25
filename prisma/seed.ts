import { PrismaClient } from '@prisma/client';

// Standalone script, deliberately NOT importing the app's shared db client
// (src/shared/lib/db.ts) — seed scripts run outside the Next.js runtime and
// should have no dependency on app-layer modules, only on Prisma directly.
const prisma = new PrismaClient();

// `level` is the ordinal the RBAC helper compares against. Higher = more
// access. Values are spaced by 10, not 1, so a future role can be inserted
// between existing ones (e.g. a level-15 role between staff and manager)
// without renumbering everything else.
const BASELINE_ROLES = [
  { name: 'staff', description: 'Day-to-day operations: stock entry, order fulfillment.', level: 10 },
  { name: 'manager', description: 'Catalog and pricing management, margin visibility.', level: 20 },
  { name: 'admin', description: 'Full system access: users, settings, audit log.', level: 30 },
] as const;

async function main(): Promise<void> {
  for (const role of BASELINE_ROLES) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description, level: role.level },
      create: role,
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${BASELINE_ROLES.length} roles.`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
