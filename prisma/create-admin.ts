import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Standalone script, same reasoning as prisma/seed.ts: no dependency on the
// app-layer db client, just Prisma directly. One-time use — creates the
// first admin login so someone can actually sign into the admin panel.
// Safe to delete after running once (or run again with a different email
// to create additional admins later, though the admin panel itself should
// handle that once a user-management screen exists).
//
// Security rules this script follows (fixed in the security-patch sprint):
// 1. The password comes from ADMIN_SETUP_PASSWORD in the environment —
//    there is NO default. The script refuses to run without it, so no
//    known/default password can ever exist in the repo or in a deploy.
// 2. An existing admin is NEVER touched: re-running the script does not
//    reset the password hash (an accidental re-run used to lock the admin
//    out by overwriting the hash with a known default).
const prisma = new PrismaClient();

const ADMIN_EMAIL = 'admin@haidarstore.pk';
const ADMIN_NAME = 'Haidar Store Admin';

async function main(): Promise<void> {
  const setupPassword = process.env.ADMIN_SETUP_PASSWORD;

  if (!setupPassword) {
    throw new Error(
      'ADMIN_SETUP_PASSWORD is not set — refusing to create an admin account without an explicit password. ' +
        'Set it in your .env file (see .env.example) and run again.',
    );
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'admin' } });

  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });

  if (existing) {
    // eslint-disable-next-line no-console
    console.log(`Admin user already exists: ${existing.email} — leaving it untouched.`);
    return;
  }

  const passwordHash = await bcrypt.hash(setupPassword, 12);

  const user = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      passwordHash,
      roleId: adminRole.id,
      status: 'ACTIVE',
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Admin user created: ${user.email}`);
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
