import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: "/home/manus/cove-storefront/.env" });
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");

const conn = await mysql.createConnection(url);
const replacements = [
  ["/media/wordpress-migration/classic-225/225-classic-gold.jpg", "/media/wordpress-migration/classic-225/225-classic-gold-v2.jpg"],
  ["/media/wordpress-migration/classic-225/225-classic-gray-white.jpg", "/media/wordpress-migration/classic-225/225-classic-gray-white-v2.jpg"],
  ["/media/wordpress-migration/classic-225/225-classic-marble-gray.jpg", "/media/wordpress-migration/classic-225/225-classic-marble-gray-v2.jpg"],
];
const tables = [
  ["attribute_values", ["image_url", "gallery_images"]],
  ["product_variants", ["image", "gallery_images"]],
  ["products", ["images"]],
];

for (const [table, cols] of tables) {
  for (const col of cols) {
    const [exists] = await conn.query(`SHOW COLUMNS FROM \`${table}\` LIKE ?`, [col]);
    if (!exists.length) continue;
    for (const [from, to] of replacements) {
      const [res] = await conn.execute(
        `UPDATE \`${table}\` SET \`${col}\` = REPLACE(\`${col}\`, ?, ?) WHERE \`${col}\` LIKE ?`,
        [from, to, `%${from}%`]
      );
      if (res.affectedRows) console.log(`${table}.${col}: ${from} -> ${to}; rows=${res.affectedRows}`);
    }
  }
}
await conn.end();
