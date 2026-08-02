import fs from 'node:fs';
import mysql from 'mysql2/promise';

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  for (const envPath of ['.env', '/home/manus/cove-storefront/.env', '/home/ubuntu/cove_work/cove-storefront/.env']) {
    if (!fs.existsSync(envPath)) continue;
    const envText = fs.readFileSync(envPath, 'utf8');
    const match = envText.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/m);
    if (match) return match[1].replace(/^[\"']|[\"']$/g, '');
  }
  return '';
}

function parseJson(value) {
  if (Array.isArray(value) || (value && typeof value === 'object')) return value;
  if (value == null || value === '') return null;
  try { return JSON.parse(value); } catch { return value; }
}

const sampleSlugs = [
  'mini-roshina-beige',
  'mini-roshina-gray',
  'mini-roshina-black',
  'tissue-box-beige',
  'black-trash-bin',
  'country-167',
  'roshina-mubkhar-petrol',
];

const dbUrl = readDatabaseUrl();
if (!dbUrl) throw new Error('DATABASE_URL not found');
const db = await mysql.createConnection(dbUrl);
try {
  const [columns] = await db.query('SHOW COLUMNS FROM product_attributes');
  const [variantColumns] = await db.query('SHOW COLUMNS FROM product_variants');
  const [statusTypes] = await db.query('SELECT status, type, COUNT(*) AS count FROM products GROUP BY status, type ORDER BY status, type');
  const [coverage] = await db.query(`
    SELECT
      p.status,
      p.type,
      COUNT(DISTINCT p.id) AS products,
      COUNT(pv.id) AS variants,
      SUM(CASE WHEN pv.galleryImages IS NOT NULL AND JSON_LENGTH(pv.galleryImages) > 0 THEN 1 ELSE 0 END) AS variantsWithGallery,
      SUM(CASE WHEN pv.image IS NOT NULL AND pv.image != '' THEN 1 ELSE 0 END) AS variantsWithImage
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.productId
    GROUP BY p.status, p.type
    ORDER BY p.status, p.type
  `);
  const [variableMissing] = await db.query(`
    SELECT p.id, p.slug, p.name, p.status, p.type,
      COUNT(pv.id) AS variantCount,
      SUM(CASE WHEN pv.galleryImages IS NOT NULL AND JSON_LENGTH(pv.galleryImages) > 0 THEN 1 ELSE 0 END) AS variantsWithGallery,
      SUM(CASE WHEN pv.image IS NOT NULL AND pv.image != '' THEN 1 ELSE 0 END) AS variantsWithImage
    FROM products p
    LEFT JOIN product_variants pv ON p.id = pv.productId
    WHERE p.status = 'active' AND p.type <> 'simple'
    GROUP BY p.id, p.slug, p.name, p.status, p.type
    ORDER BY variantsWithGallery ASC, p.slug ASC
  `);
  const placeholders = sampleSlugs.map(() => '?').join(',');
  const [sampleRows] = await db.query(`
    SELECT p.slug, p.name AS productName, p.status, p.type,
      pv.id AS variantId, pv.name AS variantName, pv.attributes, pv.image, pv.galleryImages
    FROM products p
    JOIN product_variants pv ON p.id = pv.productId
    WHERE p.slug IN (${placeholders})
    ORDER BY p.slug, pv.id
  `, sampleSlugs);

  const result = {
    generatedAt: new Date().toISOString(),
    productAttributeColumns: columns.map(c => c.Field),
    productVariantColumns: variantColumns.map(c => c.Field),
    statusTypes,
    coverage,
    activeNonSimpleProducts: variableMissing,
    samples: sampleRows.map(row => ({
      ...row,
      attributes: parseJson(row.attributes),
      galleryImages: parseJson(row.galleryImages),
    })),
  };
  console.log(JSON.stringify(result, null, 2));
} finally {
  await db.end();
}
