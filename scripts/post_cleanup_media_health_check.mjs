import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(new URL('/home/manus/cove-storefront/package.json', import.meta.url));
const mysql = require('mysql2/promise');

const appRoot = '/home/manus/cove-storefront';
const publicRoot = path.join(appRoot, 'public');
const reportDir = process.env.POST_CLEANUP_QA_REPORT_DIR || path.join(appRoot, 'reports', `post-cleanup-media-health-${new Date().toISOString().replace(/[:.]/g, '-')}`);

const referenceTargets = [
  { table: 'products', id: 'id', label: ['name','title','sku','slug'], columns: ['images'], usageClass: 'commerce_active' },
  { table: 'categories', id: 'id', label: ['name','title','slug'], columns: ['image'], usageClass: 'commerce_active' },
  { table: 'product_variants', id: 'id', label: ['sku','name','title'], columns: ['image', 'galleryImages'], usageClass: 'commerce_active' },
  { table: 'pages', id: 'id', label: ['title','name','slug','route'], columns: ['puckData'], usageClass: 'cms_active' },
  { table: 'page_blocks', id: 'id', label: ['type'], columns: ['config'], usageClass: 'cms_active' },
  { table: 'homepage_sections', id: 'id', label: ['title','name','type'], columns: ['imageUrl'], usageClass: 'cms_active' },
  { table: 'order_items', id: 'id', label: ['name','orderId'], columns: ['image'], usageClass: 'historical_order_snapshot' }
];

function loadEnv() {
  const envPath = path.join(appRoot, '.env');
  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    if (!rawLine || rawLine.trim().startsWith('#') || !rawLine.includes('=')) continue;
    const idx = rawLine.indexOf('=');
    const key = rawLine.slice(0, idx).trim();
    let val = rawLine.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}

function extractMediaUrls(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  const out = new Set();
  for (const m of s.matchAll(/(?:https?:\/\/app\.coveinterior\.com)?\/media\/[A-Za-z0-9_.,%()\-+&=@~!#$;'\[\]{}\/]+/g)) {
    out.add(String(m[0]).replace(/^https?:\/\/app\.coveinterior\.com/, '').replace(/["'\])},.]+$/, ''));
  }
  return [...out].filter(u => u.startsWith('/media/'));
}

function publicPathForUrl(url) {
  return path.join(publicRoot, url.replace(/^\//, ''));
}

async function columnSet(conn) {
  const [cols] = await conn.execute('SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE()');
  return new Set(cols.map(r => `${r.tableName}.${r.columnName}`));
}

loadEnv();
fs.mkdirSync(reportDir, { recursive: true });
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const cols = await columnSet(conn);
const usageRows = [];
const skippedTargets = [];

for (const target of referenceTargets) {
  if (!cols.has(`${target.table}.${target.id}`)) {
    skippedTargets.push({ target: target.table, reason: 'missing_id_column' });
    continue;
  }
  const existingRefCols = target.columns.filter(c => cols.has(`${target.table}.${c}`));
  if (!existingRefCols.length) {
    skippedTargets.push({ target: target.table, reason: 'no_reference_columns_found' });
    continue;
  }
  const labelCols = target.label.filter(c => cols.has(`${target.table}.${c}`));
  const selectCols = [...new Set([target.id, ...labelCols, ...existingRefCols])];
  const [rows] = await conn.execute(`SELECT ${selectCols.map(c => `\`${c}\``).join(', ')} FROM \`${target.table}\``);
  for (const row of rows) {
    const label = labelCols.map(c => row[c]).filter(Boolean).join(' | ');
    for (const column of existingRefCols) {
      for (const url of extractMediaUrls(row[column])) {
        usageRows.push({ tableName: target.table, recordId: String(row[target.id]), label, columnName: column, usageClass: target.usageClass, url });
      }
    }
  }
}

const uniqueUrls = [...new Set(usageRows.map(r => r.url))].sort();
const urlChecks = [];
for (const url of uniqueUrls) {
  const filePath = publicPathForUrl(url);
  const fileExists = fs.existsSync(filePath);
  const st = fileExists ? fs.statSync(filePath) : null;
  const mediaAssetCols = ['id', 'url', 'filename', 'fileName', 'mimeType', 'mime_type', 'size', 'fileSize'].filter(c => cols.has(`media_assets.${c}`));
  const [dbRows] = await conn.execute(`SELECT ${mediaAssetCols.map(c => `\`${c}\``).join(', ')} FROM media_assets WHERE url = ? LIMIT 10`, [url]);
  const usages = usageRows.filter(r => r.url === url);
  urlChecks.push({
    url,
    filePath,
    fileExists,
    fileSizeBytes: st ? st.size : null,
    mediaAssetRows: dbRows.length,
    mediaAssetIds: dbRows.map(r => r.id),
    mediaAssetRowsSample: dbRows,
    usageCount: usages.length,
    usageClasses: [...new Set(usages.map(r => r.usageClass))].join(','),
    referencedAt: usages.slice(0, 20).map(r => `${r.tableName}.${r.columnName}#${r.recordId}`).join(';')
  });
}

await conn.end();

const summary = {
  reportDir,
  checkedAt: new Date().toISOString(),
  referenceRows: usageRows.length,
  uniqueReferencedMediaUrls: uniqueUrls.length,
  missingFiles: urlChecks.filter(r => !r.fileExists).length,
  missingMediaAssetRows: urlChecks.filter(r => r.mediaAssetRows === 0).length,
  duplicateMediaAssetRows: urlChecks.filter(r => r.mediaAssetRows > 1).length,
  skippedTargets,
  byUsageClass: usageRows.reduce((acc, r) => { acc[r.usageClass] = (acc[r.usageClass] || 0) + 1; return acc; }, {})
};

fs.writeFileSync(path.join(reportDir, 'post_cleanup_media_usage_rows.json'), JSON.stringify(usageRows, null, 2));
fs.writeFileSync(path.join(reportDir, 'post_cleanup_media_url_checks.json'), JSON.stringify(urlChecks, null, 2));
fs.writeFileSync(path.join(reportDir, 'post_cleanup_media_health_summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
