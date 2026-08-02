const mysql = require('mysql2/promise');
const fs = require('fs');

function loadEnv(path) {
  const out = {};
  for (const line of fs.readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

(async () => {
  const slugs = ['mini-roshina-beige', 'roshina-2-cement-green', 'tissue-box-black', 'bronze-trash-bin'];
  const db = await mysql.createConnection(loadEnv('/home/manus/cove-storefront/.env').DATABASE_URL);
  const [rows] = await db.query(
    `SELECT p.slug, p.name AS productName, a.name AS attributeName, a.displayType,
            av.id AS valueId, av.labelEn AS label, av.swatch, av.image,
            pa.activeValueIds
       FROM products p
       JOIN product_attributes pa ON pa.productId = p.id
       JOIN attributes a ON a.id = pa.attributeId
       JOIN JSON_TABLE(pa.activeValueIds, '$[*]' COLUMNS (valueId INT PATH '$')) jt
       JOIN attribute_values av ON av.id = jt.valueId
      WHERE p.slug IN (?) AND a.displayType = 'image'
      ORDER BY p.slug, a.name, jt.valueId`,
    [slugs]
  );
  console.log(JSON.stringify(rows, null, 2));
  await db.end();
})().catch(err => { console.error(err); process.exit(1); });
