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
const [wpRows] = await conn.execute(
  'SELECT COUNT(*) AS count, SUM(sizeBytes) AS totalBytes FROM media_assets WHERE tenantId = ? AND `key` LIKE ? AND isActive = 1',
  [1, 'wordpress-migration/%']
);
const [sourceRows] = await conn.execute(
  'SELECT sourceSystem, COUNT(*) AS count FROM media_assets WHERE tenantId = ? GROUP BY sourceSystem ORDER BY count DESC',
  [1]
);
const [sampleRows] = await conn.execute(
  'SELECT id, `key`, url, sourceUrl, mimeType, sizeBytes, sha256 FROM media_assets WHERE tenantId = ? AND `key` LIKE ? ORDER BY id DESC LIMIT 10',
  [1, 'wordpress-migration/%']
);
await conn.end();

function walk(dir) {
  let count = 0;
  let bytes = 0;
  if (!fs.existsSync(dir)) return { count, bytes };
  for (const name of fs.readdirSync(dir)) {
    const p = `${dir}/${name}`;
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      const child = walk(p);
      count += child.count;
      bytes += child.bytes;
    } else {
      count++;
      bytes += st.size;
    }
  }
  return { count, bytes };
}

const disk = walk('/home/manus/cove-storefront/public/media/wordpress-migration');
console.log(JSON.stringify({
  wordpressMigrationMediaAssets: wpRows[0],
  diskFilesUnderWordpressMigration: disk,
  sourceSystemBreakdown: sourceRows,
  recentWordpressMigrationRecords: sampleRows,
}, null, 2));
