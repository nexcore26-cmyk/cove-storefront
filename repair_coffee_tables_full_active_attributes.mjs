import mysql from 'mysql2/promise';
import fs from 'node:fs';

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envCandidates = ['.env', '/var/www/cove/.env', '/opt/cove/.env'];
  for (const envPath of envCandidates) {
    if (!fs.existsSync(envPath)) continue;
    const envText = fs.readFileSync(envPath, 'utf8');
    const match = envText.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/m);
    if (match) return match[1].replace(/^[\'\"]|[\'\"]$/g, '');
  }
  return '';
}

function normalizeIds(value) {
  if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
  if (value == null || value === '') return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(Number).filter(Number.isFinite) : [];
  } catch {
    return [];
  }
}

function sameIds(a, b) {
  return JSON.stringify(normalizeIds(a)) === JSON.stringify(normalizeIds(b));
}

const dryRun = process.argv.includes('--dry-run');
const dbUrl = readDatabaseUrl();
if (!dbUrl) throw new Error('DATABASE_URL not found');
const db = await mysql.createConnection(dbUrl);

// Source of truth: live WordPress product variation tables checked on coveinterior.com.
// Attribute IDs: 18 Color, 19 Size, 20 Top Surface, 21 Capsule Tray, 22 Steel.
const targetBySlug = new Map(Object.entries({
  'classic-157': {
    18: [214, 215, 216],
    22: [357, 358],
    20: [350, 349],
    21: [354, 353],
  },
  'classic-157-bohemian': {
    22: [357],
    20: [350],
    21: [354, 353],
  },
  'classic-157-gray-white': {
    22: [357],
    20: [350],
    21: [354, 353],
  },
  'classic-225': {
    18: [294, 295, 296],
    22: [357, 358],
    20: [350, 349],
    21: [354, 353],
  },
  'classic-225-bohemian': {
    22: [357],
    20: [349],
    21: [354, 353],
  },
  // classic-157-gold, classic-225-brown, and classic-225-gold are out of stock/unavailable
  // on WordPress and are intentionally not expanded by this script.
  'country-112': {
    18: [258, 259, 260, 261, 262, 263, 264, 265, 266],
    21: [354, 353],
  },
  'country-167': {
    18: [220, 221, 222, 223, 224, 225, 226, 227, 228],
    21: [354, 353],
  },
  'country-62': {
    18: [276, 277, 278, 279, 284, 283, 280, 282, 281],
    21: [354, 353],
  },
  'curve-120': {
    18: [248, 249, 250, 251, 252],
    21: [354, 353],
  },
  'curve-180': {
    18: [238, 239, 240, 241, 242],
    21: [354, 353],
  },
  'decaf': {
    21: [354, 353],
  },
  'mini-caf': {
    21: [354, 353],
  },
}));

const slugs = [...targetBySlug.keys()];
const [rows] = await db.query(`
SELECT p.id AS productId, p.slug, p.name, pa.id AS productAttributeId, pa.attributeId, pa.activeValueIds
FROM products p
JOIN product_attributes pa ON pa.productId = p.id
WHERE p.slug IN (${slugs.map(() => '?').join(',')})
ORDER BY p.slug, pa.attributeId
`, slugs);

const bySlugAttr = new Map();
for (const row of rows) bySlugAttr.set(`${row.slug}:${row.attributeId}`, row);

const candidates = [];
const missingProductAttributeRows = [];
const unchanged = [];

for (const [slug, attrMap] of targetBySlug.entries()) {
  for (const [attrIdText, targetIds] of Object.entries(attrMap)) {
    const attrId = Number(attrIdText);
    const row = bySlugAttr.get(`${slug}:${attrId}`);
    if (!row) {
      missingProductAttributeRows.push({ slug, attributeId: attrId, targetActiveValueIds: targetIds });
      continue;
    }
    const current = normalizeIds(row.activeValueIds);
    if (sameIds(current, targetIds)) {
      unchanged.push({ slug, productAttributeId: row.productAttributeId, attributeId: attrId, current });
    } else {
      candidates.push({
        slug,
        productId: row.productId,
        productName: row.name,
        productAttributeId: row.productAttributeId,
        attributeId: attrId,
        current,
        targetActiveValueIds: targetIds,
      });
    }
  }
}

const backupTable = `product_attributes_backup_coffee_full_${new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0,14)}`;
const result = { dryRun, backupTable: dryRun ? null : backupTable, candidates, missingProductAttributeRows, unchanged };

if (!dryRun && candidates.length) {
  await db.beginTransaction();
  try {
    await db.query(
      `CREATE TABLE ${backupTable} AS SELECT pa.* FROM product_attributes pa WHERE pa.id IN (${candidates.map(() => '?').join(',')})`,
      candidates.map(c => c.productAttributeId)
    );
    for (const c of candidates) {
      await db.query(`UPDATE product_attributes SET activeValueIds = CAST(? AS JSON) WHERE id = ?`, [JSON.stringify(c.targetActiveValueIds), c.productAttributeId]);
    }
    await db.commit();
  } catch (err) {
    await db.rollback();
    throw err;
  }
}

console.log(JSON.stringify(result, null, 2));
await db.end();
