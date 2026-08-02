import dotenv from "dotenv";
import mysql from "mysql2/promise";
import fs from "fs";
if (fs.existsSync(".env")) dotenv.config({ path: ".env" });
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [products] = await conn.execute("select id, name, slug, sku from products where slug=? limit 1", ["classic-225"]);
const productId = products[0]?.id;
console.log("PRODUCT", JSON.stringify(products[0] || null));
for (const table of ["attributes", "attribute_values", "product_attributes"]) {
  const [cols] = await conn.execute(`show columns from ${table}`);
  console.log(`${table.toUpperCase()}_COLUMNS`, JSON.stringify(cols.map(c => c.Field)));
}
const [attrs] = await conn.execute(`
  select pa.id as paId, pa.attributeId, pa.activeValueIds, pa.galleryControlling, pa.isImageMaster, pa.sortOrder,
         a.name, a.displayType, a.type
  from product_attributes pa
  join attributes a on a.id = pa.attributeId
  where pa.productId=?
  order by pa.sortOrder, pa.id
`, [productId]);
for (const row of attrs) console.log("ATTR", JSON.stringify(row));
for (const row of attrs) {
  let ids = [];
  try { ids = Array.isArray(row.activeValueIds) ? row.activeValueIds : JSON.parse(row.activeValueIds || "[]"); } catch { ids = []; }
  if (!ids.length) continue;
  const placeholders = ids.map(() => "?").join(",");
  const [values] = await conn.execute(`select id, labelEn, imageUrl, swatch, price, salePrice from attribute_values where id in (${placeholders}) order by field(id, ${placeholders})`, [...ids, ...ids]);
  console.log("VALUES_FOR", row.name, JSON.stringify(values.map(v => ({ id:v.id, labelEn:v.labelEn, imageUrl:v.imageUrl ?? null, swatch:v.swatch ?? null, price:v.price ?? null, salePrice:v.salePrice ?? null }))));
}
await conn.end();
