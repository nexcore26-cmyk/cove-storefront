import 'dotenv/config';
import mysql from 'mysql2/promise';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const statements = [
  "ALTER TABLE pages ADD COLUMN puckData JSON NULL AFTER metaDescription",
  "ALTER TABLE store_settings ADD COLUMN footerSettings JSON NULL AFTER posReceiptFooter",
  "ALTER TABLE navigation_menus MODIFY COLUMN location ENUM('header','footer','mobile','sidebar','custom') NOT NULL DEFAULT 'header'",
];

const conn = await mysql.createConnection(url);
try {
  for (const statement of statements) {
    try {
      await conn.query(statement);
      console.log(`OK: ${statement}`);
    } catch (error) {
      if (error && (error.code === 'ER_DUP_FIELDNAME' || String(error.message || '').includes('Duplicate column') || String(error.message || '').includes('Data truncated for column'))) {
        console.log(`SKIP duplicate column: ${statement}`);
        continue;
      }
      throw error;
    }
  }
} finally {
  await conn.end();
}
