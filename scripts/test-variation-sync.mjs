/**
 * Test script: sync variations for Curve 180 (wcId=12425) and verify
 * that galleryImages and cog are populated correctly.
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const WC_URL = process.env.WC_MAIN_URL || 'https://coveinterior.com';
const WC_KEY = process.env.WC_MAIN_KEY;
const WC_SECRET = process.env.WC_MAIN_SECRET;
const DB_URL = process.env.DATABASE_URL;

const creds = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString('base64');

async function wcGet(path) {
  const url = new URL(`/wp-json/wc/v3/${path}`, WC_URL);
  const resp = await fetch(url.toString(), { headers: { Authorization: `Basic ${creds}` } });
  if (!resp.ok) throw new Error(`WC ${resp.status}: ${await resp.text()}`);
  return resp.json();
}

async function resolveMediaIds(ids) {
  if (!ids.length) return [];
  const url = `${WC_URL}/wp-json/wp/v2/media?include=${ids.join(',')}&_fields=id,source_url&per_page=${ids.length}`;
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json();
  const map = new Map(data.map(d => [d.id, d.source_url]));
  return ids.map(id => map.get(id)).filter(Boolean);
}

const conn = await mysql.createConnection(DB_URL);

// Get product ID for Curve 180
const [prods] = await conn.execute('SELECT id FROM products WHERE wcId = 12425 AND wcSource = "main" LIMIT 1');
const productId = prods[0]?.id;
if (!productId) { console.log('Product not found'); process.exit(1); }
console.log('Product ID:', productId);

// Fetch variations from WC
const variations = await wcGet('products/12425/variations?per_page=3');
console.log(`\nFetched ${variations.length} variations (showing first 3)`);

for (const v of variations) {
  const cogMeta = v.meta_data?.find(m =>
    m.key === '_alg_wc_cog_cost' || m.key === '_wc_cog_cost' || m.key === 'var_product_cost'
  );
  const cog = cogMeta?.value ? parseFloat(String(cogMeta.value)) : null;

  const galleryMeta = v.meta_data?.find(m => m.key === 'wd_additional_variation_images_data');
  let galleryImages = [];
  if (galleryMeta?.value) {
    const ids = String(galleryMeta.value).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
    galleryImages = await resolveMediaIds(ids);
  }

  const attrMap = {};
  for (const a of v.attributes || []) attrMap[a.name] = a.option;
  const varName = Object.values(attrMap).join(' / ') || `Variant ${v.id}`;

  console.log(`\nVariation ${v.id}: ${varName}`);
  console.log('  image:', v.image?.src || '(none)');
  console.log('  COG:', cog);
  console.log('  gallery:', galleryImages);

  // Update the variant in DB
  await conn.execute(
    `UPDATE product_variants SET
       image = ?,
       galleryImages = ?,
       cog = ?
     WHERE wcVariantId = ? AND productId = ?`,
    [
      v.image?.src || null,
      JSON.stringify(galleryImages),
      cog ? String(cog) : null,
      v.id,
      productId,
    ]
  );
  console.log('  -> Updated in DB');
}

// Verify
const [rows] = await conn.execute(
  'SELECT id, wcVariantId, name, image, galleryImages, cog FROM product_variants WHERE productId = ? LIMIT 3',
  [productId]
);
console.log('\n=== DB Verification ===');
for (const r of rows) {
  console.log(`Variant ${r.wcVariantId}: image=${r.image ? 'YES' : 'NO'}, gallery=${JSON.stringify(r.galleryImages)?.length > 2 ? 'YES' : 'EMPTY'}, cog=${r.cog}`);
}

await conn.end();
console.log('\nDone.');
