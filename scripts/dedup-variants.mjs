import mysql from 'mysql2/promise';
import 'dotenv/config';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Count before
const [[{ before }]] = await conn.query('SELECT COUNT(*) as before FROM product_variants');
console.log('Variants before:', before);

// Find duplicate (productId, wcVariantId) pairs — keep the one with highest id (most recent)
const [dupes] = await conn.query(`
  SELECT productId, wcVariantId, COUNT(*) as cnt, MAX(id) as keepId
  FROM product_variants
  WHERE wcVariantId IS NOT NULL
  GROUP BY productId, wcVariantId
  HAVING cnt > 1
`);
console.log('Duplicate groups to fix:', dupes.length);

let deleted = 0;
for (const dupe of dupes) {
  const [result] = await conn.query(
    'DELETE FROM product_variants WHERE productId = ? AND wcVariantId = ? AND id != ?',
    [dupe.productId, dupe.wcVariantId, dupe.keepId]
  );
  deleted += result.affectedRows;
}
console.log('Deleted duplicate rows:', deleted);

// Count after
const [[{ after }]] = await conn.query('SELECT COUNT(*) as after FROM product_variants');
console.log('Variants after:', after);

// Show products with most variants after cleanup
const [topProducts] = await conn.query(`
  SELECT p.name, COUNT(pv.id) as varCount
  FROM product_variants pv
  JOIN products p ON p.id = pv.productId
  GROUP BY p.id, p.name
  ORDER BY varCount DESC
  LIMIT 10
`);
console.log('\nTop products by variant count after cleanup:');
topProducts.forEach(r => console.log(` ${r.name}: ${r.varCount}`));

await conn.end();
