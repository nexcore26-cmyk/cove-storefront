import mysql from 'mysql2/promise';
import 'dotenv/config';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.query(`
  SELECT pv.id, pv.attributes, pv.image
  FROM product_variants pv
  JOIN products p ON p.id = pv.productId
  WHERE p.slug = 'curve-180'
`);

console.log('Total variants:', rows.length);

const attrValues = {};
rows.forEach(r => {
  const attrs = typeof r.attributes === 'string' ? JSON.parse(r.attributes) : r.attributes;
  if (Array.isArray(attrs)) {
    attrs.forEach(a => {
      if (!attrValues[a.name]) attrValues[a.name] = new Set();
      attrValues[a.name].add(a.option);
    });
  }
});

console.log('\nAttribute groups:');
Object.entries(attrValues).forEach(([k, v]) => {
  console.log(`  ${k} (${v.size} values):`, [...v].slice(0, 5));
});

// Check if variants have images
const withImage = rows.filter(r => r.image);
console.log('\nVariants with image:', withImage.length, '/', rows.length);

await conn.end();
