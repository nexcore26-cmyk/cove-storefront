import { config } from 'dotenv';
config();
import mysql from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error('DATABASE_URL is required'); process.exit(1); }

const connection = await mysql.createConnection(dbUrl);
console.log('Connected to database');

// Get database name from URL
const dbName = dbUrl.match(/\/([^/?]+)(\?|$)/)?.[1];
console.log('Database:', dbName);

async function addColumnIfNotExists(table, column, definition) {
  const [rows] = await connection.execute(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, table, column]
  );
  if (rows.length > 0) {
    console.log(`  (${table}.${column} already exists, skipping)`);
    return;
  }
  await connection.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
  console.log(`✓ Added ${table}.${column}`);
}

// Products table
await addColumnIfNotExists('products', 'ogImage', 'varchar(512)');

// store_settings table
await addColumnIfNotExists('store_settings', 'tapSecretKey', 'varchar(255)');
await addColumnIfNotExists('store_settings', 'codEnabled', 'tinyint(1) NOT NULL DEFAULT 0');

// users table
await addColumnIfNotExists('users', 'resetToken', 'varchar(255)');
await addColumnIfNotExists('users', 'resetTokenExpires', 'bigint');
await addColumnIfNotExists('users', 'customRoleId', 'int');
await addColumnIfNotExists('users', 'passwordHash', 'varchar(255)');
await addColumnIfNotExists('users', 'loginMethod', 'varchar(32)');

console.log('\n✅ All columns applied!');
await connection.end();
