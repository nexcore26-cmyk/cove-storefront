import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await createConnection(process.env.DATABASE_URL);

// Check all tables and their columns
const [tables] = await conn.query("SHOW TABLES");
const tableNames = tables.map(t => Object.values(t)[0]);

console.log('All tables on production:', tableNames.join(', '));
console.log('---');

// Check specific columns we know are in local schema
const checks = [
  ['products', 'seoTitle'],
  ['products', 'seoDescription'],
  ['products', 'tenantId'],
  ['categories', 'tenantId'],
  ['orders', 'tenantId'],
  ['users', 'tenantId'],
  ['product_reviews', 'id'],
  ['email_templates', 'id'],
  ['currency_rates', 'id'],
  ['custom_roles', 'id'],
  ['role_permissions', 'id'],
];

for (const [table, col] of checks) {
  try {
    const [rows] = await conn.query(`SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`, [table, col]);
    const exists = rows[0].cnt > 0;
    console.log(`${table}.${col}: ${exists ? '✅ EXISTS' : '❌ MISSING'}`);
  } catch(e) {
    console.log(`${table}.${col}: ERROR - ${e.message}`);
  }
}

await conn.end();
