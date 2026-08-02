import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
for (const table of ['attributes', 'attribute_values', 'product_attributes', 'product_variants']) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
  console.log(`--- ${table} ---`);
  for (const row of rows) console.log(`${row.Field}:${row.Type}`);
}
await conn.end();
