import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: "/home/manus/cove-storefront/.env" });
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const replacements = [
  ["/media/wordpress-migration/classic-225/225-classic-gold.jpg", "/media/wordpress-migration/classic-225/225-classic-gold-v2.jpg"],
  ["/media/wordpress-migration/classic-225/225-classic-gray-white.jpg", "/media/wordpress-migration/classic-225/225-classic-gray-white-v2.jpg"],
  ["/media/wordpress-migration/classic-225/225-classic-marble-gray.jpg", "/media/wordpress-migration/classic-225/225-classic-marble-gray-v2.jpg"],
];
const tables = [
  ["attribute_values", ["image", "image_url", "imageUrl", "gallery_images", "galleryImages"]],
  ["product_variants", ["image", "image_url", "imageUrl", "gallery_images", "galleryImages"]],
  ["products", ["images"]],
];

for (const [table, candidateCols] of tables) {
  const [cols] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
  const existing = new Set(cols.map(c => c.Field));
  for (const col of candidateCols.filter(c => existing.has(c))) {
    for (const [from, to] of replacements) {
      const [res] = await conn.execute(
        `UPDATE \`${table}\` SET \`${col}\` = REPLACE(\`${col}\`, ?, ?) WHERE \`${col}\` LIKE ?`,
        [from, to, `%${from}%`]
      );
      if (res.affectedRows) console.log(`${table}.${col}: ${from} -> ${to}; rows=${res.affectedRows}`);
    }
  }
}

const [rows] = await conn.query(`SELECT id, labelEn, image, galleryImages FROM attribute_values WHERE labelEn IN (?, ?, ?) ORDER BY labelEn`, [
  "225 Classic Gold",
  "225 Classic Gray / White",
  "225 Classic Marble / Gray",
]);
console.log("color attribute value media:", JSON.stringify(rows, null, 2));

await conn.end();
