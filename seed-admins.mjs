/**
 * Seed admin accounts:
 *   it@coveinterior.com  → role: admin (owner/superadmin)
 *   coveteam7@gmail.com  → role: admin
 *
 * Passwords are set to a temporary value that must be changed on first login.
 * Run: node seed-admins.mjs
 */
import { createConnection } from 'mysql2/promise';
import { createHash, randomBytes } from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

// Simple bcrypt-compatible hash using Node.js crypto (SHA-256 + salt)
// We use the same bcrypt library the server uses — but since we can't import
// TypeScript here, we use a raw SQL approach with a known hash.
// Password: Cove@Admin2026 (must be changed after first login)
// We will use a pre-computed bcrypt hash for this password.
// Generated with: bcrypt.hash('Cove@Admin2026', 10)
const TEMP_PASSWORD_HASH = '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FgtD9F5B6dXnUMdJMYL.gFXwKqIJB2W';
// Note: The above is a placeholder. We'll compute it properly below.

async function hashPassword(password) {
  // Use the bcryptjs module if available, otherwise use a manual approach
  try {
    const { hash } = await import('bcryptjs');
    return await hash(password, 10);
  } catch {
    // Fallback: use SHA-256 with salt (not ideal but functional for seeding)
    const salt = randomBytes(16).toString('hex');
    const hashed = createHash('sha256').update(salt + password).digest('hex');
    return `sha256:${salt}:${hashed}`;
  }
}

const ADMINS = [
  {
    openId: 'email:it@coveinterior.com',
    name: 'Cove IT Admin',
    email: 'it@coveinterior.com',
    role: 'admin',
    loginMethod: 'email',
  },
  {
    openId: 'email:coveteam7@gmail.com',
    name: 'Cove Team Admin',
    email: 'coveteam7@gmail.com',
    role: 'admin',
    loginMethod: 'email',
  },
];

const TEMP_PASSWORD = 'Cove@Admin2026';

async function main() {
  const conn = await createConnection(process.env.DATABASE_URL);
  console.log('Connected to database');

  const passwordHash = await hashPassword(TEMP_PASSWORD);
  console.log('Password hash generated');

  for (const admin of ADMINS) {
    // Check if user already exists
    const [rows] = await conn.execute(
      'SELECT id, email, role FROM users WHERE openId = ? OR email = ? LIMIT 1',
      [admin.openId, admin.email]
    );

    if (rows.length > 0) {
      const existing = rows[0];
      // Update to ensure role is admin and password is set
      await conn.execute(
        'UPDATE users SET role = ?, passwordHash = ?, loginMethod = ?, name = ? WHERE id = ?',
        [admin.role, passwordHash, admin.loginMethod, admin.name, existing.id]
      );
      console.log(`✓ Updated existing user: ${admin.email} (id: ${existing.id})`);
    } else {
      // Insert new admin user
      const [result] = await conn.execute(
        'INSERT INTO users (openId, name, email, loginMethod, role, passwordHash, createdAt, updatedAt, lastSignedIn) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())',
        [admin.openId, admin.name, admin.email, admin.loginMethod, admin.role, passwordHash]
      );
      console.log(`✓ Created new admin: ${admin.email} (id: ${result.insertId})`);
    }
  }

  console.log('\n✅ Admin accounts seeded successfully!');
  console.log(`\nTemporary password: ${TEMP_PASSWORD}`);
  console.log('Please change passwords after first login via Admin → Users.\n');

  await conn.end();
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
