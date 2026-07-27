import { loadEnv } from '../../../../main/config/env';
import { createDatabase } from '../../../../main/persistence/database';
import { BunPasswordHasher } from '../crypto/bun-password-hasher';
import { DrizzleAdminUserRepository } from '../repositories/drizzle-admin-user.repository';

async function seedIdentity() {
  const env = loadEnv();
  const email = env.IDENTITY_SEED_ADMIN_EMAIL;
  const password = env.IDENTITY_SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      'IDENTITY_SEED_ADMIN_EMAIL and IDENTITY_SEED_ADMIN_PASSWORD are required',
    );
  }

  const database = createDatabase(env.DATABASE_URL);
  const users = new DrizzleAdminUserRepository(database.db);
  const passwords = new BunPasswordHasher();

  try {
    const passwordHash = await passwords.hash(password);
    const user = await users.upsertByEmail({
      name: env.IDENTITY_SEED_ADMIN_NAME,
      email,
      passwordHash,
      role: 'admin',
      active: true,
    });

    console.log(
      JSON.stringify({
        seeded: true,
        email: user.email,
        role: user.role,
        active: user.active,
      }),
    );
  } finally {
    await database.close();
  }
}

if (import.meta.main) {
  await seedIdentity();
}
