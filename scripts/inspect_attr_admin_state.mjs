import dotenv from "dotenv";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";

const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");

const conn = await mysql.createConnection(url);
const [products] = await conn.execute(
  "select id, name, slug, sku from products where slug=? or name=? limit 5",
  ["classic-225", "Classic 225"]
);
console.log(JSON.stringify({ products }, null, 2));
const productId = products[0]?.id;
if (!productId) {
  await conn.end();
  process.exit(0);
}

const [attrs] = await conn.execute(`
  select pa.id as productAttributeId, pa.productId, pa.attributeId, pa.isVariation, pa.isVisible, pa.isGalleryController,
         a.name, a.slug, a.displayType, a.type, a.isImageMaster,
         count(pav.id) as valueCount,
         sum(case when coalesce(av.imageUrl, av.image_url, '') <> '' then 1 else 0 end) as valuesWithImages
  from product_attributes pa
  join attributes a on a.id = pa.attributeId
  left join product_attribute_values pav on pav.productAttributeId = pa.id
  left join attribute_values av on av.id = pav.attributeValueId
  where pa.productId=?
  group by pa.id, pa.productId, pa.attributeId, pa.isVariation, pa.isVisible, pa.isGalleryController, a.name, a.slug, a.displayType, a.type, a.isImageMaster
  order by pa.position, pa.id
`, [productId]);
console.log(JSON.stringify({ attributes: attrs }, null, 2));

const [values] = await conn.execute(`
  select a.name as attributeName, av.id, av.value, av.slug, av.imageUrl, av.image_url, av.colorCode
  from product_attributes pa
  join attributes a on a.id = pa.attributeId
  join product_attribute_values pav on pav.productAttributeId = pa.id
  join attribute_values av on av.id = pav.attributeValueId
  where pa.productId=?
  order by pa.position, pav.position, av.id
`, [productId]);
console.log(JSON.stringify({ values }, null, 2));

await conn.end();
