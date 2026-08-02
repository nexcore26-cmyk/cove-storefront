/**
 * Re-links brass products to their correct brass category IDs.
 * The duplicate cleanup deleted the high-numbered category IDs (180xxx)
 * that brass products were pointing to. We need to update them to point
 * to the surviving brass category IDs (150xxx).
 *
 * Strategy: fetch all brass products with their WC category ID from the
 * WC raw data, then find the matching brass category by wcId.
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Build a map of wcId → our category id for brass categories
const [brassCats] = await conn.execute(
  "SELECT id, wcId FROM categories WHERE wcSource = 'brass' AND wcId IS NOT NULL"
);
const catMap = new Map(brassCats.map(c => [c.wcId, c.id]));
console.log('Brass category map size:', catMap.size);

// Get all brass products with their wcRawData to extract the WC category
const [brassProds] = await conn.execute(
  "SELECT id, name, wcRawData FROM products WHERE wcSource = 'brass'"
);
console.log('Brass products to fix:', brassProds.length);

let fixed = 0;
let skipped = 0;
for (const prod of brassProds) {
  const raw = prod.wcRawData;
  if (!raw) { skipped++; continue; }
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const firstCat = data.categories?.[0];
  if (!firstCat) { skipped++; continue; }
  const newCatId = catMap.get(firstCat.id);
  if (!newCatId) { 
    console.log('  No brass cat found for wcId:', firstCat.id, 'product:', prod.name);
    skipped++; 
    continue; 
  }
  await conn.execute('UPDATE products SET categoryId = ? WHERE id = ?', [newCatId, prod.id]);
  fixed++;
}

console.log('Fixed:', fixed, '| Skipped:', skipped);

// Verify
const [[{broken}]] = await conn.execute(
  "SELECT COUNT(*) as broken FROM products p LEFT JOIN categories c ON p.categoryId = c.id WHERE p.wcSource = 'brass' AND c.id IS NULL"
);
console.log('Remaining broken brass product links:', broken);

await conn.end();
