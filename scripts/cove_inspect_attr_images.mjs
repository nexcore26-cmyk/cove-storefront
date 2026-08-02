import dotenv from "dotenv";
import mysql from "mysql2/promise";

dotenv.config({ path: "/home/manus/cove-storefront/.env" });
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [cols] = await conn.query("SHOW COLUMNS FROM attribute_values");
console.log("attribute_values columns:", cols.map(c => c.Field).join(", "));
const selectCols = cols.map(c => c.Field);
const availableImageCols = ["image", "image_url", "imageUrl", "gallery_images", "galleryImages"].filter(c => selectCols.includes(c));
const sql = `SELECT id, value${availableImageCols.length ? ", " + availableImageCols.map(c => `\`${c}\``).join(", ") : ""}
  FROM attribute_values
  WHERE value IN (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ORDER BY value, id`;
const [rows] = await conn.query(sql, [
  "225 Classic Gold",
  "225 Classic Gray / White",
  "225 Classic Marble / Gray",
  "Gold",
  "Silver",
  "Clear glass",
  "Solid top",
  "Big capsule",
  "Small capsule",
]);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
