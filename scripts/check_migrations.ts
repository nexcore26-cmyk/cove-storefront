import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  try {
    const [rows]: any = await conn.query("SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 5");
    console.log('Last 5 applied migrations:');
    rows.forEach((r: any) => console.log(' -', r.hash));
  } catch (e: any) {
    console.log('Error:', e.message);
  }
  await conn.end();
}

main().catch(console.error);
