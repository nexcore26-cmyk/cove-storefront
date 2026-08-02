import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const db = await createConnection(process.env.DATABASE_URL);

const [publishedRows] = await db.execute('SELECT COUNT(*) as cnt FROM products WHERE status = "publish"');
const [allRows] = await db.execute('SELECT COUNT(*) as cnt FROM products');
const [statusRows] = await db.execute('SELECT status, COUNT(*) as cnt FROM products GROUP BY status');
const [sampleRows] = await db.execute('SELECT id, name, status FROM products LIMIT 5');
const [catRows] = await db.execute('SELECT id, name, slug FROM categories LIMIT 10');

console.log('Total products:', JSON.stringify(allRows[0]));
console.log('Published products:', JSON.stringify(publishedRows[0]));
console.log('By status:', JSON.stringify(statusRows));
console.log('Sample products:', JSON.stringify(sampleRows));
console.log('Sample categories:', JSON.stringify(catRows));

await db.end();
