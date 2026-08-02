const fs = require('fs');
const path = require('path');
for (const name of ['.env', '.env.production', '.env.local']) {
  const p = path.join(process.cwd(), name);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] ||= value;
  }
}
async function main() {
  let mysql;
  try {
    mysql = require('mysql2/promise');
  } catch (err) {
    console.error('mysql2/promise is not resolvable from application dependencies');
    throw err;
  }
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.TIDB_DATABASE_URL;
  if (!url) throw new Error('Missing database URL for headerSettings migration');
  const conn = await mysql.createConnection(url);
  const [cols] = await conn.query("SHOW COLUMNS FROM `store_settings` LIKE ?", ['headerSettings']);
  if (!cols.length) {
    await conn.query("ALTER TABLE `store_settings` ADD `headerSettings` JSON NULL");
    console.log('Added store_settings.headerSettings');
  } else {
    console.log('store_settings.headerSettings already exists');
  }
  await conn.end();
}
main().catch((err) => { console.error(err); process.exit(1); });
