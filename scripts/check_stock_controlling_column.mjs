import mysql from "mysql2/promise";
import "dotenv/config";
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");
const conn = await mysql.createConnection(url);
const [dbRows] = await conn.query("SELECT DATABASE() AS db");
const dbName = dbRows[0].db;
const [rows] = await conn.query(
  "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
  [dbName, "product_attributes", "stockControlling"]
);
console.log(JSON.stringify({ database: dbName, stockControllingColumn: rows }, null, 2));
await conn.end();
