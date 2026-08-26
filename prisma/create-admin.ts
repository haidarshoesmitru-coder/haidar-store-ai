import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Standalone script, same reasoning as prisma/seed.ts: no dependency on the
// app-layer db client, just Prisma directly. One-time use — creates the
// first admin login so someone can actually sign into the admin panel.
// Safe to delete after running once (or run again with a different email
// to create additional admins later, though the admin panel itself should
// handle that once a user-management screen exists).
const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@haidarstore.pk';
const ADMIN_PASSWORD = 'ChangeMe123!';
const ADMIN_NAME = 'Haidar Store Admin';

async function main(): Promise<void> {
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash, roleId: adminRole.id, status: 'ACTIVE' },
    create: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      roleId: adminRole.id,
      status: 'ACTIVE',
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Admin user ready: ${user.email}`);
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to create admin user:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
