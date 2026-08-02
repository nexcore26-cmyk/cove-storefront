/**
 * Re-fetches brass products from WooCommerce and updates their categoryId
 * to point to the correct surviving brass category IDs.
 * Only updates categoryId - does not touch other fields.
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const WC_URL = process.env.WC_BRASS_URL;
const WC_KEY = process.env.WC_BRASS_KEY;
const WC_SECRET = process.env.WC_BRASS_SECRET;

if (!WC_URL || !WC_KEY || !WC_SECRET) {
  console.error('Missing WC_BRASS_* env vars');
  process.exit(1);
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Build wcId → our category id map for brass categories
const [brassCats] = await conn.execute(
  "SELECT id, wcId FROM categories WHERE wcSource = 'brass' AND wcId IS NOT NULL"
);
const catMap = new Map(brassCats.map(c => [c.wcId, c.id]));
console.log('Brass category map:', catMap.size, 'entries');

// Fetch all brass products from WC API
async function wcFetchAll(endpoint, params = {}) {
  const results = [];
  let page = 1;
  const perPage = 100;
  while (true) {
    const url = new URL(`${WC_URL}/wp-json/wc/v3/${endpoint}`);
    url.searchParams.set('per_page', String(perPage));
    url.searchParams.set('page', String(page));
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
    const auth = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Basic ${auth}` },
    });
    if (!res.ok) {
      console.error('WC API error:', res.status, await res.text());
      break;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < perPage) break;
    page++;
    process.stdout.write(`\rFetched ${results.length} products...`);
  }
  console.log(`\nTotal fetched: ${results.length}`);
  return results;
}

console.log('Fetching brass products from WC API...');
const wcProds = await wcFetchAll('products', { status: 'any' });

let fixed = 0;
let skipped = 0;
for (const wcp of wcProds) {
  const firstCat = wcp.categories?.[0];
  if (!firstCat) { skipped++; continue; }
  const newCatId = catMap.get(firstCat.id);
  if (!newCatId) { 
    skipped++;
    continue;
  }
  // Find our product by wcId
  const [rows] = await conn.execute(
    "SELECT id FROM products WHERE wcId = ? AND wcSource = 'brass' LIMIT 1",
    [wcp.id]
  );
  if (!rows.length) { skipped++; continue; }
  await conn.execute(
    'UPDATE products SET categoryId = ? WHERE id = ?',
    [newCatId, rows[0].id]
  );
  fixed++;
}

console.log('Fixed:', fixed, '| Skipped:', skipped);

// Verify
const [[{broken}]] = await conn.execute(
  "SELECT COUNT(*) as broken FROM products p LEFT JOIN categories c ON p.categoryId = c.id WHERE p.wcSource = 'brass' AND c.id IS NULL"
);
console.log('Remaining broken brass product links:', broken);

await conn.end();
