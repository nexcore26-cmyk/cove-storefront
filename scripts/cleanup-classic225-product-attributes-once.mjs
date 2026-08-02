import 'dotenv/config';
import mysql from 'mysql2/promise';

const apply = process.argv.includes('--apply');
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [[product]] = await conn.query("SELECT id, slug, name FROM products WHERE slug='classic-225' LIMIT 1");
if (!product) throw new Error('classic-225 not found');
const keepNames = ['Size', 'Color', 'Steel', 'Top Surface', 'Coffee Capsule Size'];
const [before] = await conn.query(
  "SELECT pa.id AS productAttributeId, pa.attributeId, a.name, a.displayType, pa.galleryControlling, pa.isImageMaster, pa.sortOrder, JSON_LENGTH(pa.activeValueIds) AS activeValues FROM product_attributes pa JOIN attributes a ON a.id=pa.attributeId WHERE pa.productId=? ORDER BY pa.sortOrder, pa.id",
  [product.id]
);
const keepIds = before.filter(r => keepNames.includes(r.name)).map(r => r.attributeId);
const removeIds = before.filter(r => !keepNames.includes(r.name)).map(r => r.productAttributeId);
if (apply && removeIds.length) {
  await conn.query(`DELETE FROM product_attributes WHERE productId=? AND id IN (${removeIds.map(() => '?').join(',')})`, [product.id, ...removeIds]);
}
if (apply) {
  for (const [idx, name] of keepNames.entries()) {
    await conn.query(
      "UPDATE product_attributes pa JOIN attributes a ON a.id=pa.attributeId SET pa.sortOrder=?, pa.galleryControlling=?, pa.isImageMaster=? WHERE pa.productId=? AND a.name=?",
      [idx, name === 'Color', name === 'Color', product.id, name]
    );
  }
}
const [after] = await conn.query(
  "SELECT pa.id AS productAttributeId, pa.attributeId, a.name, a.displayType, pa.galleryControlling, pa.isImageMaster, pa.sortOrder, JSON_LENGTH(pa.activeValueIds) AS activeValues FROM product_attributes pa JOIN attributes a ON a.id=pa.attributeId WHERE pa.productId=? ORDER BY pa.sortOrder, pa.id",
  [product.id]
);
console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', product, keepNames, keepIds, removeProductAttributeIds: removeIds, before, after }, null, 2));
await conn.end();
