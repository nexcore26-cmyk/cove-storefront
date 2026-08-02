import 'dotenv/config';
import mysql from 'mysql2/promise';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const connection = await mysql.createConnection(databaseUrl);
const schemaName = new URL(databaseUrl).pathname.replace(/^\//, '');

async function addColumnIfNotExists(table, column, definition) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [schemaName, table, column]
  );
  if (Number(rows[0]?.count ?? 0) === 0) {
    console.log(`Adding ${table}.${column}`);
    await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  } else {
    console.log(`Column ${table}.${column} already exists`);
  }
}

await addColumnIfNotExists('product_variants', 'isDownloadable', 'TINYINT(1) NOT NULL DEFAULT 0');
await addColumnIfNotExists('product_variants', 'isVirtual', 'TINYINT(1) NOT NULL DEFAULT 0');
await addColumnIfNotExists('product_variants', 'manageStock', 'TINYINT(1) NOT NULL DEFAULT 0');
await addColumnIfNotExists('product_variants', 'shippingClassId', 'INT NULL');

await connection.end();
console.log('Variant WooCommerce fields migration complete');
