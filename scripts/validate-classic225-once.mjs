import 'dotenv/config';
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [[product]] = await conn.query("SELECT id, slug, name FROM products WHERE slug='classic-225' LIMIT 1");
if (!product) throw new Error('classic-225 not found');
const [attrs] = await conn.query(
  "SELECT a.name, a.displayType, pa.galleryControlling, pa.isImageMaster, JSON_LENGTH(pa.activeValueIds) AS activeValues FROM product_attributes pa JOIN attributes a ON a.id=pa.attributeId WHERE pa.productId=? ORDER BY pa.sortOrder",
  [product.id]
);
const [[variants]] = await conn.query(
  "SELECT COUNT(*) AS total, SUM(isActive=1) AS active, COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.Color'))) AS colors FROM product_variants WHERE productId=?",
  [product.id]
);
const [sample] = await conn.query(
  "SELECT sku, JSON_UNQUOTE(JSON_EXTRACT(attributes, '$.Color')) AS color, image, JSON_LENGTH(galleryImages) AS galleryCount FROM product_variants WHERE productId=? ORDER BY id LIMIT 5",
  [product.id]
);
console.log(JSON.stringify({ product, attrs, variants, sample }, null, 2));
await conn.end();
