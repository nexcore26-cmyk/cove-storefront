import { config } from 'dotenv';
config();
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error('DATABASE_URL is required'); process.exit(1); }
const connection = await mysql.createConnection(dbUrl);
const db = drizzle(connection);
console.log('Running migrations from drizzle/migrations folder...');
try {
  await migrate(db, { migrationsFolder: join(__dirname, 'drizzle', 'migrations') });
  console.log('Migrations completed successfully!');
} catch (err) {
  console.error('Migration error:', err.message);
  process.exit(1);
} finally {
  await connection.end();
}
