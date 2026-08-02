import mysql from 'mysql2/promise';
import fs from 'node:fs';

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envText = fs.readFileSync('.env', 'utf8');
  const match = envText.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/m);
  return match ? match[1].replace(/^['\"]|['\"]$/g, '') : '';
}

const dryRun = process.argv.includes('--dry-run');
const db = await mysql.createConnection(readDatabaseUrl());

const sizeBySlug = new Map([
  ['classic-157', 330],
  ['classic-157-bohemian', 330],
  ['classic-157-gray-white', 330],
  ['classic-225', 333],
  ['classic-225-bohemian', 333],
  ['classic-225-gold', 333],
  ['country-112', 332],
  ['country-167', 338],
  ['country-62', 331],
  ['curve-120', 341],
  ['curve-180', 340],
  ['decaf', 346],
  ['mini-caf', 344],
]);

const [rows] = await db.query(`
WITH RECURSIVE cat_tree AS (
  SELECT id FROM categories WHERE slug='coffee-tables'
  UNION ALL
  SELECT c.id FROM categories c JOIN cat_tree ct ON c.parentId=ct.id
)
SELECT p.id AS productId, p.slug, p.name, pa.id AS productAttributeId, pa.activeValueIds
FROM products p
JOIN product_attributes pa ON pa.productId=p.id AND pa.attributeId=19
WHERE p.status='active' AND p.categoryId IN (SELECT id FROM cat_tree)
ORDER BY p.slug
`);

const candidates = [];
const skipped = [];
for (const row of rows) {
  const target = sizeBySlug.get(row.slug);
  let current = [];
  try { current = Array.isArray(row.activeValueIds) ? row.activeValueIds : JSON.parse(row.activeValueIds || '[]'); } catch {}
  if (!target) {
    skipped.push({ ...row, reason: 'no deterministic slug-to-size mapping', current });
  } else if (current.length > 0) {
    skipped.push({ ...row, reason: 'already has active size values', current });
  } else {
    candidates.push({ ...row, targetActiveValueIds: [target], current });
  }
}

const backupTable = `product_attributes_backup_coffee_size_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14)}`;
const result = { dryRun, backupTable: dryRun ? null : backupTable, candidates, skipped };

if (!dryRun && candidates.length) {
  await db.beginTransaction();
  try {
    await db.query(`CREATE TABLE ${backupTable} AS SELECT pa.* FROM product_attributes pa WHERE pa.id IN (${candidates.map(() => '?').join(',')})`, candidates.map(c => c.productAttributeId));
    for (const c of candidates) {
      await db.query(`UPDATE product_attributes SET activeValueIds=CAST(? AS JSON) WHERE id=?`, [JSON.stringify(c.targetActiveValueIds), c.productAttributeId]);
    }
    await db.commit();
  } catch (err) {
    await db.rollback();
    throw err;
  }
}

console.log(JSON.stringify(result, null, 2));
await db.end();
