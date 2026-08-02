import mysql from 'mysql2/promise';
import 'dotenv/config';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Check total variants and duplicates
const [total] = await conn.query('SELECT COUNT(*) as cnt FROM product_variants');
console.log('Total variants:', total[0].cnt);

// Find products with many variants (likely duplicates)
const [topProducts] = await conn.query(`
  SELECT p.name, p.slug, COUNT(pv.id) as varCount
  FROM product_variants pv
  JOIN products p ON p.id = pv.productId
  GROUP BY p.id, p.name, p.slug
  ORDER BY varCount DESC
  LIMIT 10
`);
console.log('\nProducts with most variants:');
topProducts.forEach(r => console.log(` ${r.name}: ${r.varCount} variants`));

// Check if variants have wcVariationId (unique identifier from WC)
const [withWcId] = await conn.query('SELECT COUNT(*) as cnt FROM product_variants WHERE wcVariationId IS NOT NULL');
console.log('\nVariants with wcVariationId:', withWcId[0].cnt);

// Check duplicates by (productId, wcVariationId)
const [dupes] = await conn.query(`
  SELECT productId, wcVariationId, COUNT(*) as cnt
  FROM product_variants
  WHERE wcVariationId IS NOT NULL
  GROUP BY productId, wcVariationId
  HAVING cnt > 1
  LIMIT 10
`);
console.log('Duplicate (productId, wcVariationId) pairs:', dupes.length);
if (dupes.length > 0) {
  console.log('Sample:', dupes.slice(0, 3));
}

// Count how many variants would remain after dedup
const [uniqueCount] = await conn.query(`
  SELECT COUNT(DISTINCT CONCAT(productId, '-', COALESCE(wcVariationId, id))) as cnt
  FROM product_variants
`);
console.log('\nUnique variants after dedup:', uniqueCount[0].cnt);

await conn.end();
