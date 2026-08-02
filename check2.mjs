import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await createConnection(process.env.DATABASE_URL);

// Count rows
const [[{cnt: pCnt}]] = await conn.query('SELECT COUNT(*) as cnt FROM products');
const [[{cnt: cCnt}]] = await conn.query('SELECT COUNT(*) as cnt FROM categories');
const [[{cnt: aCnt}]] = await conn.query('SELECT COUNT(*) as cnt FROM attributes');

// Get columns of products table
const [cols] = await conn.query("SHOW COLUMNS FROM products");
const colNames = cols.map(c => c.Field);

// Sample without tenantId
const [sample] = await conn.query('SELECT id, name, status FROM products LIMIT 5');

// Check if tenantId column exists
const hasTenantId = colNames.includes('tenantId') || colNames.includes('tenant_id');

console.log('Total products:', pCnt);
console.log('Categories:', cCnt);
console.log('Attributes:', aCnt);
console.log('Has tenantId column:', hasTenantId);
console.log('Products columns:', colNames.join(', '));
console.log('Sample products:', JSON.stringify(sample, null, 2));

await conn.end();
