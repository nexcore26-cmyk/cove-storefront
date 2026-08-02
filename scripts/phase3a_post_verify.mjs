import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(new URL('/home/manus/cove-storefront/package.json', import.meta.url));
const mysql = require('mysql2/promise');

const appRoot = '/home/manus/cove-storefront';
const publicRoot = path.join(appRoot, 'public');
const runId = `media-phase3a-verify-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const reportDir = path.join(appRoot, 'reports', runId);
const oldUrl = 'https://coveinterior.com/wp-content/uploads/2022/07/1-feature-ar.jpg';
const targetUrl = '/media/wordpress-migration/2022/07/1.png';
const targetPublicUrl = `https://app.coveinterior.com${targetUrl}`;

function loadEnv() {
  const envPath = path.join(appRoot, '.env');
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!rawLine || rawLine.trim().startsWith('#') || !rawLine.includes('=')) continue;
    const idx = rawLine.indexOf('=');
    const key = rawLine.slice(0, idx).trim();
    let val = rawLine.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    process.env[key] = val;
  }
}

function stableStringifyValue(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

async function headOrGet(url) {
  const startedAt = Date.now();
  try {
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    if (!res.ok || res.status === 405) res = await fetch(url, { method: 'GET', redirect: 'follow' });
    return {
      url,
      ok: res.ok,
      status: res.status,
      contentType: res.headers.get('content-type'),
      contentLength: res.headers.get('content-length'),
      elapsedMs: Date.now() - startedAt
    };
  } catch (error) {
    return { url, ok: false, error: error.message, elapsedMs: Date.now() - startedAt };
  }
}

loadEnv();
fs.mkdirSync(reportDir, { recursive: true });
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const [referenceCounts] = await conn.execute(`
  SELECT 'page_blocks' AS tableName, 'config' AS columnName, COUNT(*) AS countRows FROM page_blocks WHERE CAST(config AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
  UNION ALL SELECT 'pages', 'puckData', COUNT(*) FROM pages WHERE CAST(puckData AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
  UNION ALL SELECT 'homepage_sections', 'imageUrl', COUNT(*) FROM homepage_sections WHERE CAST(imageUrl AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
  UNION ALL SELECT 'products', 'images', COUNT(*) FROM products WHERE CAST(images AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
  UNION ALL SELECT 'categories', 'image', COUNT(*) FROM categories WHERE CAST(image AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
  UNION ALL SELECT 'product_variants', 'image', COUNT(*) FROM product_variants WHERE CAST(image AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
  UNION ALL SELECT 'product_variants', 'galleryImages', COUNT(*) FROM product_variants WHERE CAST(galleryImages AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
`);

const [pageRows] = await conn.execute('SELECT id, pageId, blockType, config FROM page_blocks WHERE id = 30015');
const pageText = stableStringifyValue(pageRows[0]?.config);
const [backupRows] = await conn.execute(
  `SELECT runId, tableName, recordId, columnName, actionType, oldSha256, newSha256, createdAt
   FROM media_reference_migration_backups
   WHERE tableName = 'page_blocks' AND recordId = '30015' AND columnName = 'config' AND actionType = 'phase3a_rewrite_remaining_page_block_wp_media_url'
   ORDER BY id DESC`
);
const [assetRows] = await conn.execute('SELECT id, url, sourceUrl, mimeType, sizeBytes, sha256, originalFilename FROM media_assets WHERE url = ?', [targetUrl]);
await conn.end();

const targetFilePath = path.join(publicRoot, targetUrl.replace(/^\//, ''));
const httpCheck = await headOrGet(targetPublicUrl);
const summary = {
  runId,
  verifiedAt: new Date().toISOString(),
  target: { oldUrl, targetUrl, targetPublicUrl, pageBlockId: 30015 },
  referenceCounts,
  pageBlockCheck: {
    recordExists: !!pageRows.length,
    pageId: pageRows[0]?.pageId,
    blockType: pageRows[0]?.blockType,
    oldUrlOccurrences: pageText.split(oldUrl).length - 1,
    targetUrlOccurrences: pageText.split(targetUrl).length - 1
  },
  mediaAssetCheck: { count: assetRows.length, rows: assetRows },
  filesystemCheck: { path: targetFilePath, exists: fs.existsSync(targetFilePath) },
  httpCheck,
  rollbackBackupCheck: { count: backupRows.length, rows: backupRows },
  destructiveCleanupPerformed: false
};

fs.writeFileSync(path.join(reportDir, 'phase3a_post_verify_summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
