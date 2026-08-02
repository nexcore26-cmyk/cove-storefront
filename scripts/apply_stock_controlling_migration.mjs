import fs from "node:fs";
import mysql from "mysql2/promise";
import "dotenv/config";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");

const backupPath = process.argv[2];
if (!backupPath) throw new Error("Backup path argument missing");

const migrationSql = fs.readFileSync("drizzle/0035_stock_controlling_product_attributes.sql", "utf8").trim();
const conn = await mysql.createConnection({ uri: url, multipleStatements: false });

try {
  const [dbRows] = await conn.query("SELECT DATABASE() AS db");
  const dbName = dbRows[0].db;

  const [createRows] = await conn.query("SHOW CREATE TABLE `product_attributes`");
  fs.writeFileSync(backupPath, createRows[0]["Create Table"] + "\n");

  const [existing] = await conn.query(
    "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [dbName, "product_attributes", "stockControlling"]
  );

  if (existing.length > 0) {
    console.log(JSON.stringify({ applied: false, reason: "column_already_exists", database: dbName }, null, 2));
  } else {
    await conn.query(migrationSql);
    const [after] = await conn.query(
      "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [dbName, "product_attributes", "stockControlling"]
    );
    console.log(JSON.stringify({ applied: true, database: dbName, column: after }, null, 2));
  }
} finally {
  await conn.end();
}
