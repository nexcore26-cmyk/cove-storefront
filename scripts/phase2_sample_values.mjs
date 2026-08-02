import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(new URL('/home/manus/cove-storefront/package.json', import.meta.url));
const mysql = require('mysql2/promise');

for (const rawLine of fs.readFileSync('/home/manus/cove-storefront/.env', 'utf8').split(/\r?\n/)) {
  if (!rawLine || rawLine.trim().startsWith('#') || !rawLine.includes('=')) continue;
  const idx = rawLine.indexOf('=');
  const key = rawLine.slice(0, idx).trim();
  let val = rawLine.slice(idx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  process.env[key] = val;
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const queries = [
  ['products', 'SELECT id,name,sku,images,ogImage FROM products ORDER BY id LIMIT 10'],
  ['categories', 'SELECT id,name,slug,image FROM categories ORDER BY id'],
  ['pages', 'SELECT id,slug,title,CHAR_LENGTH(CAST(puckData AS CHAR)) AS puckLen, LEFT(CAST(puckData AS CHAR),500) AS puckSample FROM pages ORDER BY id'],
  ['page_blocks', 'SELECT id,pageId,blockType,CHAR_LENGTH(CAST(config AS CHAR)) AS configLen, LEFT(CAST(config AS CHAR),500) AS configSample FROM page_blocks ORDER BY id LIMIT 20'],
  ['homepage_sections', 'SELECT id,sectionKey,imageUrl,LEFT(CAST(content AS CHAR),500) AS contentSample FROM homepage_sections ORDER BY id LIMIT 20'],
  ['product_variants', 'SELECT id,productId,sku,name,image,galleryImages FROM product_variants WHERE image IS NOT NULL OR JSON_LENGTH(galleryImages) > 0 ORDER BY id LIMIT 20'],
  ['attribute_values', 'SELECT id,attributeId,value,image,galleryImages FROM attribute_values WHERE image IS NOT NULL OR JSON_LENGTH(galleryImages) > 0 ORDER BY id LIMIT 20']
];
for (const [label, sql] of queries) {
  console.log(`\n--- ${label}`);
  try {
    const [rows] = await conn.execute(sql);
    console.log(JSON.stringify(rows, null, 2).slice(0, 8000));
  } catch (error) {
    console.log(`ERR ${error.message}`);
  }
}
await conn.end();
