import mysql from 'mysql2/promise';
import fs from 'node:fs';

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const envText = fs.readFileSync('.env', 'utf8');
    for (const line of envText.split(/\r?\n/)) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
      if (m) return m[1].replace(/^['\"]|['\"]$/g, '');
    }
  } catch {}
  return '';
}

const dbUrl = readDatabaseUrl();
if (!dbUrl) throw new Error('DATABASE_URL is required');
const conn = await mysql.createConnection(dbUrl);

const [cats] = await conn.query(`
WITH RECURSIVE cat_tree AS (
  SELECT id, name, slug, parentId FROM categories WHERE slug='coffee-tables'
  UNION ALL
  SELECT c.id, c.name, c.slug, c.parentId FROM categories c JOIN cat_tree ct ON c.parentId=ct.id
)
SELECT * FROM cat_tree ORDER BY parentId, id
`);
const catIds = cats.map(c => c.id);
console.log(JSON.stringify({ categories: cats }, null, 2));

if (!catIds.length) process.exit(0);
const placeholders = catIds.map(() => '?').join(',');
const [products] = await conn.query(`
SELECT p.id, p.name, p.slug, p.sku, p.price, p.images, p.description, c.name AS categoryName, c.slug AS categorySlug,
       (SELECT COUNT(*) FROM product_variants pv WHERE pv.productId=p.id AND pv.isActive=1) AS variantCount
FROM products p
LEFT JOIN categories c ON c.id=p.categoryId
WHERE p.status='active' AND p.categoryId IN (${placeholders})
ORDER BY c.slug, p.slug
`, catIds);

const report = [];
for (const p of products) {
  const [attrs] = await conn.query(`
    SELECT pa.id AS productAttributeId, pa.attributeId, pa.activeValueIds, a.name AS attrName, a.displayType, a.type AS attrType
    FROM product_attributes pa
    JOIN attributes a ON a.id=pa.attributeId
    WHERE pa.productId=?
    ORDER BY pa.sortOrder, pa.id
  `, [p.id]);
  const attrReports = [];
  for (const pa of attrs) {
    let activeIds = [];
    try { activeIds = Array.isArray(pa.activeValueIds) ? pa.activeValueIds : JSON.parse(pa.activeValueIds || '[]'); } catch {}
    const allIds = activeIds.length ? activeIds : [-1];
    const [vals] = activeIds.length ? await conn.query(`
      SELECT id, labelEn, image, galleryImages, swatch, sortOrder
      FROM attribute_values
      WHERE id IN (${activeIds.map(() => '?').join(',')})
      ORDER BY sortOrder, id
    `, activeIds) : [[]];
    attrReports.push({ ...pa, activeValueIds: activeIds, activeValues: vals.map(v => ({
      id: v.id, labelEn: v.labelEn, hasImage: !!v.image, image: v.image, galleryCount: (() => { try { const g = Array.isArray(v.galleryImages) ? v.galleryImages : JSON.parse(v.galleryImages || '[]'); return Array.isArray(g) ? g.length : 0; } catch { return 0; } })(), swatch: v.swatch
    })) });
  }
  const [variants] = await conn.query(`SELECT id, sku, name, attributes, image, galleryImages FROM product_variants WHERE productId=? AND isActive=1 ORDER BY id LIMIT 15`, [p.id]);
  report.push({ id: p.id, name: p.name, slug: p.slug, sku: p.sku, category: p.categorySlug, variantCount: Number(p.variantCount), images: p.images, attributes: attrReports, sampleVariants: variants });
}
console.log(JSON.stringify({ productCount: products.length, products: report }, null, 2));
await conn.end();
