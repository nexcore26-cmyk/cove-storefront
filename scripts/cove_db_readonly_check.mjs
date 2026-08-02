import fs from "fs";
import { createRequire } from "module";
const require = createRequire(new URL("../package.json", import.meta.url));
const env = fs.readFileSync(".env", "utf8");
for (const line of env.split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
  const idx = line.indexOf("=");
  const k = line.slice(0, idx).trim();
  let v = line.slice(idx + 1).trim();
  if ((v.startsWith("\"") && v.endsWith("\"")) || (v.startsWith(") && v.endsWith("))) v = v.slice(1,-1);
  process.env[k] = v;
}
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL missing");
const mysql = require("mysql2/promise");
const conn = await mysql.createConnection(dbUrl);
const [cols] = await conn.query("SHOW COLUMNS FROM media_assets");
const [cnt] = await conn.query("SELECT COUNT(*) AS count FROM media_assets");
const [sample] = await conn.query("SELECT id, tenantId, `key`, url, sourceSystem, mimeType, sizeBytes, originalFilename, isActive FROM media_assets ORDER BY id DESC LIMIT 3");
console.log(JSON.stringify({media_assets_count: cnt[0].count, columns: cols.map(c=>({field:c.Field,type:c.Type,null:c.Null,key:c.Key,default:c.Default})), sample}, null, 2));
await conn.end();
