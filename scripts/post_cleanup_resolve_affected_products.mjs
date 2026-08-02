import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(new URL('/home/manus/cove-storefront/package.json', import.meta.url));
const mysql = require('mysql2/promise');
for (const rawLine of fs.readFileSync('/home/manus/cove-storefront/.env','utf8').split(/\r?\n/)) {
  if (!rawLine || rawLine.trim().startsWith('#') || !rawLine.includes('=')) continue;
  const i = rawLine.indexOf('=');
  const k = rawLine.slice(0,i).trim();
  let v = rawLine.slice(i+1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1,-1);
  if (!process.env[k]) process.env[k] = v;
}
const ids = [390062,390063,390123,390131,390132,390133,390169,390170,390171,390172,390173,390174,390175,390176,390177,390178,390179];
const c = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await c.query('SELECT id, name, slug, status, images FROM products WHERE id IN (?) ORDER BY id', [ids]);
console.log(JSON.stringify(rows, null, 2));
await c.end();
