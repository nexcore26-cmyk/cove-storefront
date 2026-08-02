import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const db = drizzle(conn);
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migration successful');
  } catch(e: any) {
    console.error('Migration error:', e.message);
    console.error('SQL:', e.sqlMessage || '');
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
