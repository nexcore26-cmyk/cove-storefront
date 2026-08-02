import fs from 'fs';
import path from 'path';
import mysql from 'mysql2/promise';

function parseEnvFile(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    env[key] = value;
  }
  return env;
}

const appDir = process.argv[2] || process.cwd();
const backupDir = process.argv[3] || path.join(appDir, 'backups', `media_cleanup_${new Date().toISOString().replace(/[:.]/g, '-')}`);
fs.mkdirSync(backupDir, { recursive: true });
const env = parseEnvFile(path.join(appDir, '.env'));
const dbUrl = new URL(env.DATABASE_URL);
const conn = await mysql.createConnection({
  host: dbUrl.hostname,
  port: Number(dbUrl.port || 3306),
  user: decodeURIComponent(dbUrl.username),
  password: decodeURIComponent(dbUrl.password),
  database: dbUrl.pathname.replace(/^\//, ''),
});

const [rows] = await conn.query('SELECT * FROM media_assets WHERE id = 328');
fs.writeFileSync(path.join(backupDir, 'media_assets_id_328_before.json'), JSON.stringify(rows, null, 2));
let action = 'no_change';
if (rows.length && rows[0].isActive === 1 && rows[0].key === 'admin-uploads/tenant-1/2026/05/cove_native_media_validation_upload_cad353d5.png') {
  await conn.query('UPDATE media_assets SET isActive = 0 WHERE id = 328 AND `key` = ? AND entityId IS NULL', [rows[0].key]);
  action = 'deactivated_id_328';
}
const [after] = await conn.query('SELECT id, `key`, url, isActive, entityType, entityId FROM media_assets WHERE id = 328');
fs.writeFileSync(path.join(backupDir, 'media_assets_id_328_after.json'), JSON.stringify(after, null, 2));
await conn.end();
console.log(JSON.stringify({ action, backupDir, beforeCount: rows.length, after }, null, 2));
