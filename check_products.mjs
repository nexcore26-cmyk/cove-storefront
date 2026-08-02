import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const conn = await createConnection(process.env.DATABASE_URL);

const [[{cnt: pCnt}]] = await conn.query('SELECT COUNT(*) as cnt FROM products');
const [[{cnt: cCnt}]] = await conn.query('SELECT COUNT(*) as cnt FROM categories');
const [[{cnt: aCnt}]] = await conn.query('SELECT COUNT(*) as cnt FROM attributes');
const [sample] = await conn.query('SELECT id, name, status, tenantId FROM products LIMIT 5');
const [[{cnt: activeCnt}]] = await conn.query("SELECT COUNT(*) as cnt FROM products WHERE status='publish'");
const [tenants] = await conn.query('SELECT DISTINCT tenantId FROM products LIMIT 10');

console.log('Total products:', pCnt);
console.log('Active (publish) products:', activeCnt);
console.log('Categories:', cCnt);
console.log('Attributes:', aCnt);
console.log('Distinct tenantIds in products:', JSON.stringify(tenants));
console.log('Sample products:', JSON.stringify(sample, null, 2));

await conn.end();
