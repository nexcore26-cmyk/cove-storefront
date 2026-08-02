import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await createConnection(process.env.DATABASE_URL);

const colCheck = async (table, col) => {
  const [[{cnt}]] = await conn.query(
    `SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, col]
  );
  return cnt > 0;
};

// Add seoTitle to products
if (!(await colCheck('products', 'seoTitle'))) {
  await conn.query('ALTER TABLE products ADD COLUMN seoTitle VARCHAR(255) NULL');
  console.log('✅ Added products.seoTitle');
} else {
  console.log('  products.seoTitle already exists');
}

// Add seoDescription to products
if (!(await colCheck('products', 'seoDescription'))) {
  await conn.query('ALTER TABLE products ADD COLUMN seoDescription TEXT NULL');
  console.log('✅ Added products.seoDescription');
} else {
  console.log('  products.seoDescription already exists');
}

console.log('✅ Done! All missing columns added.');
await conn.end();
