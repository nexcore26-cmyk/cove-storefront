import dotenv from "dotenv";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
if (fs.existsSync(".env")) dotenv.config({ path: ".env" });
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [tables] = await conn.execute("show tables");
const tableNames = tables.map((row) => Object.values(row)[0]).filter((name) => /attr|variant|variation|product/i.test(name));
console.log(JSON.stringify({ tableNames }, null, 2));
for (const t of tableNames.filter((name) => /attr|variant/i.test(name))) {
  const [cols] = await conn.execute(`show columns from \`${t}\``);
  console.log("TABLE", t);
  console.log(JSON.stringify(cols.map(c => ({Field:c.Field, Type:c.Type, Null:c.Null, Key:c.Key, Default:c.Default})), null, 2));
}
await conn.end();
