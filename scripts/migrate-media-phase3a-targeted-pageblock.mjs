import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(new URL('/home/manus/cove-storefront/package.json', import.meta.url));
const mysql = require('mysql2/promise');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const verifyOnly = args.has('--verify-only');
const appRoot = '/home/manus/cove-storefront';
const publicRoot = path.join(appRoot, 'public');
const runId = `media-phase3a-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const reportDir = path.join(appRoot, 'reports', runId);

const target = {
  table: 'page_blocks',
  id: 30015,
  column: 'config',
  oldUrl: 'https://coveinterior.com/wp-content/uploads/2022/07/1-feature-ar.jpg',
  newUrl: '/media/wordpress-migration/2022/07/1.png',
  expectedBlockType: 'text_html',
  reason: 'Replace the single remaining non-order WordPress media URL in Arabic page-block HTML with the verified Node media asset already used by the English counterpart.'
};

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
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function sha(value) {
  return crypto.createHash('sha256').update(value ?? '').digest('hex');
}

function localPathForUrl(url) {
  if (!url || !url.startsWith('/media/')) return null;
  return path.join(publicRoot, url.replace(/^\//, ''));
}

async function ensureBackupTable(conn) {
  await conn.execute(`CREATE TABLE IF NOT EXISTS media_reference_migration_backups (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    runId VARCHAR(128) NOT NULL,
    tableName VARCHAR(128) NOT NULL,
    recordId VARCHAR(128) NOT NULL,
    columnName VARCHAR(128) NOT NULL,
    oldValue LONGTEXT NULL,
    newValue LONGTEXT NULL,
    actionType VARCHAR(64) NOT NULL,
    oldSha256 CHAR(64) NOT NULL,
    newSha256 CHAR(64) NOT NULL,
    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_media_ref_backup_run (runId),
    INDEX idx_media_ref_backup_record (tableName, recordId, columnName)
  )`);
}

async function backupAndUpdate(conn, change) {
  await conn.execute(
    `INSERT INTO media_reference_migration_backups (runId, tableName, recordId, columnName, oldValue, newValue, actionType, oldSha256, newSha256)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [runId, change.table, String(change.id), change.column, change.oldValue, change.newValue, change.actionType, sha(change.oldValue), sha(change.newValue)]
  );
  await conn.execute(`UPDATE \`${change.table}\` SET \`${change.column}\` = ? WHERE id = ?`, [change.newValue, change.id]);
}

loadEnv();
fs.mkdirSync(reportDir, { recursive: true });

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const summary = {
  runId,
  startedAt: new Date().toISOString(),
  mode: apply ? 'apply' : verifyOnly ? 'verify-only' : 'dry-run',
  target,
  safeguards: [
    'Single-record scope: page_blocks.id=30015 only',
    'Exact old URL replacement only',
    'Target Node media file must exist on disk',
    'Target media_assets row must exist',
    'Apply mode writes rollback backup row before update',
    'No Media Library cleanup and no filesystem deletion'
  ]
};
const skipped = [];
const changes = [];

try {
  const targetPath = localPathForUrl(target.newUrl);
  summary.targetFile = { path: targetPath, exists: !!targetPath && fs.existsSync(targetPath) };
  if (!summary.targetFile.exists) throw new Error(`Refusing Phase 3A because target file is missing: ${target.newUrl}`);

  const [assetRows] = await conn.execute('SELECT id, url, sourceUrl, mimeType, sizeBytes, sha256, originalFilename FROM media_assets WHERE url = ? LIMIT 5', [target.newUrl]);
  summary.targetMediaAssets = assetRows;
  if (!assetRows.length) throw new Error(`Refusing Phase 3A because no media_assets record exists for target URL: ${target.newUrl}`);

  const [rows] = await conn.execute('SELECT id, pageId, blockType, config FROM page_blocks WHERE id = ?', [target.id]);
  if (!rows.length) throw new Error(`Refusing Phase 3A because page_blocks.id=${target.id} does not exist`);

  const row = rows[0];
  summary.currentRecord = { id: row.id, pageId: row.pageId, blockType: row.blockType };
  if (row.blockType !== target.expectedBlockType) {
    skipped.push({ type: 'record_guard', reason: 'unexpected_block_type', expected: target.expectedBlockType, actual: row.blockType });
  }

  const oldText = stableStringifyValue(row.config);
  const oldOccurrences = oldText.split(target.oldUrl).length - 1;
  const alreadyNewOccurrences = oldText.split(target.newUrl).length - 1;
  summary.currentOccurrences = { oldUrl: oldOccurrences, newUrl: alreadyNewOccurrences };

  if (oldOccurrences === 0) {
    skipped.push({ type: 'target_url', reason: 'old_url_not_present', oldUrl: target.oldUrl });
  }

  if (!skipped.length && oldOccurrences > 0) {
    const newText = oldText.replaceAll(target.oldUrl, target.newUrl);
    changes.push({
      table: target.table,
      id: target.id,
      column: target.column,
      oldValue: oldText,
      newValue: newText,
      actionType: 'phase3a_rewrite_remaining_page_block_wp_media_url',
      detail: {
        from: target.oldUrl,
        to: target.newUrl,
        replacements: oldOccurrences,
        reason: target.reason
      }
    });
  }

  summary.proposedChanges = changes.length;
  summary.skippedCount = skipped.length;

  if (apply && !verifyOnly) {
    await conn.beginTransaction();
    try {
      await ensureBackupTable(conn);
      for (const change of changes) await backupAndUpdate(conn, change);
      await conn.commit();
      summary.appliedChanges = changes.length;
    } catch (error) {
      await conn.rollback();
      summary.applyError = error.message;
      throw error;
    }
  } else {
    summary.appliedChanges = 0;
  }

  const [postRows] = await conn.execute('SELECT id, pageId, blockType, config FROM page_blocks WHERE id = ?', [target.id]);
  const postText = stableStringifyValue(postRows[0]?.config);
  summary.postCheck = {
    oldUrlOccurrences: postText ? postText.split(target.oldUrl).length - 1 : null,
    newUrlOccurrences: postText ? postText.split(target.newUrl).length - 1 : null
  };

  const [remainingNonOrder] = await conn.execute(`
    SELECT 'page_blocks' AS tableName, 'config' AS columnName, COUNT(*) AS countRows FROM page_blocks WHERE CAST(config AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
    UNION ALL SELECT 'pages', 'puckData', COUNT(*) FROM pages WHERE CAST(puckData AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
    UNION ALL SELECT 'homepage_sections', 'imageUrl', COUNT(*) FROM homepage_sections WHERE CAST(imageUrl AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
    UNION ALL SELECT 'products', 'images', COUNT(*) FROM products WHERE CAST(images AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
    UNION ALL SELECT 'categories', 'image', COUNT(*) FROM categories WHERE CAST(image AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
    UNION ALL SELECT 'product_variants', 'image', COUNT(*) FROM product_variants WHERE CAST(image AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
    UNION ALL SELECT 'product_variants', 'galleryImages', COUNT(*) FROM product_variants WHERE CAST(galleryImages AS CHAR) LIKE '%coveinterior.com/wp-content/uploads/%'
  `);
  summary.remainingNonOrderWordpressReferenceCounts = remainingNonOrder;
} finally {
  summary.finishedAt = new Date().toISOString();
  await conn.end();
}

fs.writeFileSync(path.join(reportDir, 'phase3a_summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(reportDir, 'phase3a_changes.json'), JSON.stringify(changes, null, 2));
fs.writeFileSync(path.join(reportDir, 'phase3a_skipped.json'), JSON.stringify(skipped, null, 2));
const csvRows = ['table,id,column,actionType,oldSha256,newSha256,detail'];
for (const c of changes) {
  const vals = [c.table, c.id, c.column, c.actionType, sha(c.oldValue), sha(c.newValue), JSON.stringify(c.detail || {})];
  csvRows.push(vals.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
}
fs.writeFileSync(path.join(reportDir, 'phase3a_changes.csv'), csvRows.join('\n') + '\n');
console.log(JSON.stringify(summary, null, 2));
