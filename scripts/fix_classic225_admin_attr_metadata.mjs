import dotenv from "dotenv";
import mysql from "mysql2/promise";
import fs from "fs";
if (fs.existsSync(".env")) dotenv.config({ path: ".env" });
const dryRun = process.argv.includes("--dry-run");
const conn = await mysql.createConnection(process.env.DATABASE_URL);
await conn.beginTransaction();
try {
  const [products] = await conn.execute("select id, name, slug from products where slug = ? or name like ? limit 5", ["classic-225", "%Classic 225%"]);
  if (products.length === 0) throw new Error("Classic 225 product not found");
  const product = products[0];

  const [assigned] = await conn.execute(`
    select pa.id as productAttributeId, pa.attributeId, pa.activeValueIds, pa.galleryControlling,
           a.name, a.displayType
    from product_attributes pa
    join attributes a on a.id = pa.attributeId
    where pa.productId = ?
    order by pa.sortOrder, pa.id
  `, [product.id]);

  const getDesiredDisplayType = (name) => {
    const key = String(name || "").trim().toLowerCase();
    if (key === "color" || key === "select color") return "image";
    if (key === "size" || key.includes("steel") || key.includes("top surface") || key.includes("coffee capsule")) return "button";
    return null;
  };
  const parseActiveIds = (raw) => {
    const text = String(raw || "").trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(Number).filter(Number.isFinite);
      if (parsed && typeof parsed === "object") {
        return Object.entries(parsed)
          .filter(([, selected]) => selected === true || selected === 1 || selected === "true" || selected === "1")
          .map(([id]) => Number(id))
          .filter(Number.isFinite);
      }
    } catch {}
    return text.split(/[^0-9]+/).map(Number).filter(Number.isFinite);
  };

  const changes = [];
  for (const row of assigned) {
    const wanted = getDesiredDisplayType(row.name);
    if (!wanted) continue;
    if (row.displayType !== wanted) {
      changes.push({ type: "displayType", attributeId: row.attributeId, name: row.name, from: row.displayType, to: wanted });
      await conn.execute("update attributes set displayType = ? where id = ?", [wanted, row.attributeId]);
    }
    if (wanted !== "image") {
      const ids = parseActiveIds(row.activeValueIds);
      if (ids.length) {
        const placeholders = ids.map(() => "?").join(",");
        const [valueRows] = await conn.execute(
          `select id, labelEn, image, swatch from attribute_values where attributeId = ? and id in (${placeholders})`,
          [row.attributeId, ...ids]
        );
        for (const val of valueRows) {
          if ((val.image && String(val.image).trim()) || (val.swatch && String(val.swatch).trim())) {
            changes.push({ type: "clearValueMedia", attributeId: row.attributeId, attribute: row.name, valueId: val.id, label: val.labelEn, hadImage: Boolean(val.image), hadSwatch: Boolean(val.swatch) });
          }
        }
        await conn.execute(
          `update attribute_values set image = null, swatch = null, galleryImages = null where attributeId = ? and id in (${placeholders})`,
          [row.attributeId, ...ids]
        );
      }
    }
  }

  const [after] = await conn.execute(`
    select pa.attributeId, a.name, a.displayType, pa.galleryControlling,
           count(av.id) as activeValueCount,
           sum(case when av.image is not null and av.image <> '' then 1 else 0 end) as activeImages
    from product_attributes pa
    join attributes a on a.id = pa.attributeId
    left join attribute_values av on av.attributeId = a.id and json_contains(pa.activeValueIds, cast(av.id as json), '$')
    where pa.productId = ?
    group by pa.attributeId, a.name, a.displayType, pa.galleryControlling, pa.sortOrder, pa.id
    order by pa.sortOrder, pa.id
  `, [product.id]);

  if (dryRun) await conn.rollback();
  else await conn.commit();
  console.log(JSON.stringify({ dryRun, product, changes, after }, null, 2));
} catch (error) {
  await conn.rollback();
  console.error(error);
  process.exit(1);
} finally {
  await conn.end();
}
