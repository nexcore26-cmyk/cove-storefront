import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const c = await mysql.createConnection(process.env.DATABASE_URL);

// Check current columns
const [cols] = await c.execute('SHOW COLUMNS FROM users');
const existingCols = cols.map(r => r.Field);
console.log('Existing columns:', existingCols);

// Add missing columns if they don't exist
const toAdd = [
  { name: 'phone', sql: "ADD COLUMN `phone` varchar(32) DEFAULT NULL AFTER `email`" },
  { name: 'wcCustomerId', sql: "ADD COLUMN `wcCustomerId` int DEFAULT NULL AFTER `phone`" },
  { name: 'wcSource', sql: "ADD COLUMN `wcSource` varchar(32) DEFAULT NULL AFTER `wcCustomerId`" },
];

for (const col of toAdd) {
  if (!existingCols.includes(col.name)) {
    console.log(`Adding column: ${col.name}`);
    await c.execute(`ALTER TABLE users ${col.sql}`);
    console.log(`  ✓ Added ${col.name}`);
  } else {
    console.log(`  ✓ Column ${col.name} already exists`);
  }
}

// Verify
const [cols2] = await c.execute('SHOW COLUMNS FROM users');
console.log('Final columns:', cols2.map(r => r.Field));

await c.end();
console.log('Done!');
