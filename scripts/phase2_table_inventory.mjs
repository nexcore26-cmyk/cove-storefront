import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(new URL('/home/manus/cove-storefront/package.json', import.meta.url));
const mysql = require('mysql2/promise');

for (const rawLine of fs.readFileSync('/home/manus/cove-storefront/.env', 'utf8').split(/\r?\n/)) {
  if (!rawLine || rawLine.trim().startsWith('#') || !rawLine.includes('=')) continue;
  const idx = rawLine.indexOf('=');
  const key = rawLine.slice(0, idx).trim();
  let val = rawLine.slice(idx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
  process.env[key] = val;
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [tables] = await conn.execute('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME');
console.log('TABLES');
for (const table of tables) console.log(table.TABLE_NAME);

const [cols] = await conn.execute(
  `SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE
   FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE()
     AND (
       COLUMN_NAME LIKE ? OR COLUMN_NAME LIKE ? OR COLUMN_NAME LIKE ? OR COLUMN_NAME LIKE ? OR COLUMN_NAME LIKE ?
       OR DATA_TYPE IN ('json','text','mediumtext','longtext')
     )
   ORDER BY TABLE_NAME, ORDINAL_POSITION`,
  ['%image%', '%media%', '%photo%', '%gallery%', '%url%']
);
console.log('\nRELEVANT_COLUMNS');
for (const c of cols) console.log(`${c.TABLE_NAME}\t${c.COLUMN_NAME}\t${c.DATA_TYPE}\t${c.COLUMN_TYPE}`);

const targets = ['products','product_variants','categories','cms_sections','pages','page_blocks','portfolio_projects','media_assets','attribute_values'];
console.log('\nTARGET_TABLE_COUNTS');
for (const table of targets) {
  if (!tables.some(t => t.TABLE_NAME === table)) continue;
  const [countRows] = await conn.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
  console.log(`${table}\t${countRows[0].count}`);
}
await conn.end();
