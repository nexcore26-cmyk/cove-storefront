import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(new URL('/home/manus/cove-storefront/package.json', import.meta.url));
const mysql = require('mysql2/promise');

const appRoot = '/home/manus/cove-storefront';
const publicRoot = path.join(appRoot, 'public');
const mediaRoot = path.join(publicRoot, 'media');
const runId = `media-phase4a-cleanup-inventory-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const reportDir = path.join(appRoot, 'reports', runId);

const referenceTargets = [
  { table: 'products', id: 'id', columns: ['images'], usageClass: 'commerce_active' },
  { table: 'categories', id: 'id', columns: ['image'], usageClass: 'commerce_active' },
  { table: 'product_variants', id: 'id', columns: ['image', 'galleryImages'], usageClass: 'commerce_active' },
  { table: 'pages', id: 'id', columns: ['puckData'], usageClass: 'cms_active' },
  { table: 'page_blocks', id: 'id', columns: ['config'], usageClass: 'cms_active' },
  { table: 'homepage_sections', id: 'id', columns: ['imageUrl'], usageClass: 'cms_active' },
  { table: 'order_items', id: 'id', columns: ['image'], usageClass: 'historical_order_snapshot' }
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

function walkMedia(dir, prefix = '') {
  const rows = [];
  if (!fs.existsSync(dir)) return rows;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, ent.name);
    const rel = path.join(prefix, ent.name).replace(/\\/g, '/');
    if (ent.isDirectory()) rows.push(...walkMedia(fullPath, rel));
    else if (ent.isFile()) {
      const st = fs.statSync(fullPath);
      rows.push({ url: `/media/${rel}`, relativePath: rel, absolutePath: fullPath, sizeBytes: st.size, mtime: st.mtime.toISOString() });
    }
  }
  return rows;
}

function normalizeUrl(url) {
  return String(url ?? '').trim().replace(/^https?:\/\/app\.coveinterior\.com/, '').replace(/["'\])},.]+$/, '');
}

function extractNodeMediaUrls(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  const out = new Set();
  for (const m of s.matchAll(/(?:https?:\/\/app\.coveinterior\.com)?\/media\/[A-Za-z0-9_.,%()\-+&=@~!#$;'\[\]{}\/]+/g)) out.add(normalizeUrl(m[0]));
  return [...out].filter(u => u.startsWith('/media/'));
}

function extractWpUrls(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  const out = new Set();
  for (const m of s.matchAll(/https?:\/\/[^\s"'<>]+wp-content\/uploads\/[^\s"'<>]+/g)) out.add(String(m[0]).replace(/["'\])},.]+$/, ''));
  return [...out];
}

function csvEscape(v) {
  return '"' + String(v ?? '').replace(/"/g, '""') + '"';
}

function addMapArray(map, key, row) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(row);
}

function summarizeCounts(rows, key) {
  return rows.reduce((acc, row) => {
    acc[row[key] ?? ''] = (acc[row[key] ?? ''] || 0) + 1;
    return acc;
  }, {});
}

loadEnv();
fs.mkdirSync(reportDir, { recursive: true });
const conn = await mysql.createConnection(process.env.DATABASE_URL);
async function q(sql, params = []) { const [rows] = await conn.execute(sql, params); return rows; }

const dbNameRows = await q('SELECT DATABASE() AS dbName');
const dbName = dbNameRows[0].dbName;
const schemaColumns = await q(
  `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
   FROM INFORMATION_SCHEMA.COLUMNS
   WHERE TABLE_SCHEMA = ?`,
  [dbName]
);
const columnSet = new Set(schemaColumns.map(r => `${r.tableName}.${r.columnName}`));
const activeTargets = referenceTargets.map(t => ({ ...t, columns: t.columns.filter(c => columnSet.has(`${t.table}.${c}`)) })).filter(t => t.columns.length && columnSet.has(`${t.table}.${t.id}`));

const filesystemRows = walkMedia(mediaRoot);
const filesystemByUrl = new Map(filesystemRows.map(r => [r.url, r]));
const filesystemUrls = new Set(filesystemRows.map(r => r.url));

const mediaAssetColumns = schemaColumns.filter(r => r.tableName === 'media_assets').map(r => r.columnName);
const mediaSelectCols = ['id', 'url', 'sourceUrl', 'mimeType', 'sizeBytes', 'sha256', 'originalFilename', 'createdAt', 'updatedAt'].filter(c => mediaAssetColumns.includes(c));
if (!mediaSelectCols.includes('id') || !mediaSelectCols.includes('url')) throw new Error('media_assets must include id and url columns');
const mediaAssets = await q(`SELECT ${mediaSelectCols.map(c => `\`${c}\``).join(', ')} FROM media_assets ORDER BY id`);
const mediaAssetsByUrl = new Map();
for (const asset of mediaAssets) addMapArray(mediaAssetsByUrl, asset.url || '', asset);

const usageRows = [];
const skippedTargets = [];
for (const target of activeTargets) {
  const cols = [target.id, ...target.columns];
  let rows = [];
  try {
    rows = await q(`SELECT ${cols.map(c => `\`${c}\``).join(', ')} FROM \`${target.table}\``);
  } catch (error) {
    skippedTargets.push({ target, error: error.message });
    continue;
  }
  for (const row of rows) {
    for (const column of target.columns) {
      const value = row[column];
      for (const url of extractNodeMediaUrls(value)) {
        usageRows.push({ type: 'node_media', url, tableName: target.table, columnName: column, recordId: String(row[target.id]), usageClass: target.usageClass });
      }
      for (const url of extractWpUrls(value)) {
        usageRows.push({ type: 'wordpress_media', url, tableName: target.table, columnName: column, recordId: String(row[target.id]), usageClass: target.usageClass });
      }
    }
  }
}

const nodeUsageByUrl = new Map();
for (const usage of usageRows.filter(u => u.type === 'node_media')) addMapArray(nodeUsageByUrl, usage.url, usage);

const candidates = [];
function usageSummary(usages) {
  return usages.map(u => `${u.tableName}.${u.columnName}#${u.recordId}`).slice(0, 50).join(';');
}
function countUsageClass(usages, cls) { return usages.filter(u => u.usageClass === cls).length; }
function makeBase(row) {
  const usages = nodeUsageByUrl.get(row.url) || [];
  return {
    usageCountTotal: usages.length,
    usageCountCommerceActive: countUsageClass(usages, 'commerce_active'),
    usageCountCmsActive: countUsageClass(usages, 'cms_active'),
    usageCountHistoricalOrder: countUsageClass(usages, 'historical_order_snapshot'),
    referencedAt: usageSummary(usages)
  };
}

for (const asset of mediaAssets) {
  const url = asset.url || '';
  if (!url.startsWith('/media/')) continue;
  const fsRow = filesystemByUrl.get(url);
  const base = makeBase({ url });
  const isWpMigration = url.startsWith('/media/wordpress-migration/');
  const isAdminUpload = url.startsWith('/media/admin-uploads/');
  let classification = 'retain';
  let recommendation = 'retain_no_action';
  let reason = 'asset_exists_or_is_not_cleanup_target';
  let approvalRequired = 'no';
  if (!fsRow) {
    classification = 'blocked_missing_filesystem_file';
    recommendation = 'do_not_delete_record_until_missing_file_or_reference_history_is_investigated';
    reason = 'media_library_record_points_to_missing_filesystem_file';
  } else if (base.usageCountCommerceActive || base.usageCountCmsActive) {
    classification = 'retain_active_reference';
    recommendation = 'retain_no_action';
    reason = 'asset_is_referenced_by_active_storefront_or_cms_content';
  } else if (base.usageCountHistoricalOrder) {
    classification = 'retain_historical_order_reference';
    recommendation = 'retain_until_order_history_or_test_order_cleanup_is_separately_approved';
    reason = 'asset_is_referenced_by_order_items_history';
  } else if (isWpMigration) {
    classification = 'cleanup_candidate_review_only';
    recommendation = 'candidate_for_media_library_record_and_filesystem_file_deletion_after_explicit_row_level_approval';
    reason = 'wordpress_migration_asset_has_media_library_record_and_file_but_no_detected_references';
    approvalRequired = 'yes';
  } else if (isAdminUpload) {
    classification = 'retain_admin_upload';
    recommendation = 'retain_admin_upload_no_cleanup';
    reason = 'admin_upload_is_out_of_wordpress_migration_cleanup_scope';
  }
  candidates.push({
    candidateId: `media_asset:${asset.id}`,
    kind: 'media_asset',
    mediaAssetId: asset.id,
    url,
    filesystemPath: fsRow?.absolutePath || '',
    onDisk: !!fsRow,
    fileSizeBytes: fsRow?.sizeBytes ?? '',
    sourceUrl: asset.sourceUrl || '',
    mimeType: asset.mimeType || '',
    sha256: asset.sha256 || '',
    originalFilename: asset.originalFilename || '',
    createdAt: asset.createdAt || '',
    updatedAt: asset.updatedAt || '',
    classification,
    recommendation,
    reason,
    approvalRequired,
    ...base
  });
}

for (const fsRow of filesystemRows) {
  if (mediaAssetsByUrl.has(fsRow.url)) continue;
  const base = makeBase({ url: fsRow.url });
  let classification = 'filesystem_only_review_only';
  let recommendation = 'candidate_for_filesystem_deletion_after_explicit_row_level_approval_if_unreferenced';
  let reason = 'file_exists_under_public_media_without_media_library_record';
  let approvalRequired = 'yes';
  if (base.usageCountCommerceActive || base.usageCountCmsActive) {
    classification = 'blocked_filesystem_only_active_reference';
    recommendation = 'do_not_delete_create_or_repair_media_library_record_if_needed';
    reason = 'filesystem_only_file_is_referenced_by_active_content';
    approvalRequired = 'no';
  } else if (base.usageCountHistoricalOrder) {
    classification = 'retain_filesystem_only_historical_order_reference';
    recommendation = 'retain_until_order_history_or_test_order_cleanup_is_separately_approved';
    reason = 'filesystem_only_file_is_referenced_by_order_history';
    approvalRequired = 'no';
  } else if (!fsRow.url.startsWith('/media/wordpress-migration/')) {
    classification = 'retain_non_wordpress_filesystem_only';
    recommendation = 'retain_out_of_scope_file';
    reason = 'filesystem_only_file_is_not_under_wordpress_migration_scope';
    approvalRequired = 'no';
  }
  candidates.push({
    candidateId: `filesystem:${fsRow.relativePath}`,
    kind: 'filesystem_file',
    mediaAssetId: '',
    url: fsRow.url,
    filesystemPath: fsRow.absolutePath,
    onDisk: true,
    fileSizeBytes: fsRow.sizeBytes,
    sourceUrl: '',
    mimeType: '',
    sha256: '',
    originalFilename: path.basename(fsRow.relativePath),
    createdAt: '',
    updatedAt: '',
    classification,
    recommendation,
    reason,
    approvalRequired,
    ...base
  });
}

for (const usage of usageRows.filter(u => u.type === 'node_media' && !filesystemUrls.has(u.url))) {
  candidates.push({
    candidateId: `broken_reference:${usage.tableName}.${usage.columnName}:${usage.recordId}:${usage.url}`,
    kind: 'broken_current_reference',
    mediaAssetId: '',
    url: usage.url,
    filesystemPath: '',
    onDisk: false,
    fileSizeBytes: '',
    sourceUrl: '',
    mimeType: '',
    sha256: '',
    originalFilename: '',
    classification: 'blocked_fix_required',
    recommendation: 'do_not_cleanup_investigate_or_repair_broken_current_reference',
    reason: 'database_reference_points_to_missing_public_media_file',
    approvalRequired: 'no',
    usageCountTotal: 1,
    usageCountCommerceActive: usage.usageClass === 'commerce_active' ? 1 : 0,
    usageCountCmsActive: usage.usageClass === 'cms_active' ? 1 : 0,
    usageCountHistoricalOrder: usage.usageClass === 'historical_order_snapshot' ? 1 : 0,
    referencedAt: `${usage.tableName}.${usage.columnName}#${usage.recordId}`
  });
}

for (const usage of usageRows.filter(u => u.type === 'wordpress_media')) {
  const historical = usage.usageClass === 'historical_order_snapshot';
  candidates.push({
    candidateId: `remaining_wp_reference:${usage.tableName}.${usage.columnName}:${usage.recordId}:${usage.url}`,
    kind: 'remaining_wordpress_reference',
    mediaAssetId: '',
    url: usage.url,
    filesystemPath: '',
    onDisk: '',
    fileSizeBytes: '',
    sourceUrl: '',
    mimeType: '',
    sha256: '',
    originalFilename: '',
    classification: historical ? 'retain_historical_order_wordpress_reference' : 'blocked_remaining_wordpress_reference',
    recommendation: historical ? 'do_not_rewrite_order_history_without_separate_order_cleanup_approval' : 'investigate_remaining_wordpress_reference_before_cleanup',
    reason: historical ? 'wordpress_url_is_in_historical_order_item_snapshot' : 'wordpress_url_remains_in_non_order_content',
    approvalRequired: 'no',
    usageCountTotal: 1,
    usageCountCommerceActive: usage.usageClass === 'commerce_active' ? 1 : 0,
    usageCountCmsActive: usage.usageClass === 'cms_active' ? 1 : 0,
    usageCountHistoricalOrder: historical ? 1 : 0,
    referencedAt: `${usage.tableName}.${usage.columnName}#${usage.recordId}`
  });
}

candidates.sort((a, b) => String(a.classification).localeCompare(String(b.classification)) || String(a.kind).localeCompare(String(b.kind)) || String(a.url).localeCompare(String(b.url)));
const columns = ['candidateId','kind','mediaAssetId','url','filesystemPath','onDisk','fileSizeBytes','sourceUrl','mimeType','sha256','originalFilename','createdAt','updatedAt','classification','recommendation','reason','approvalRequired','usageCountTotal','usageCountCommerceActive','usageCountCmsActive','usageCountHistoricalOrder','referencedAt'];
fs.writeFileSync(path.join(reportDir, 'phase4a_cleanup_candidates.csv'), [columns.join(','), ...candidates.map(row => columns.map(c => csvEscape(row[c])).join(','))].join('\n') + '\n');
fs.writeFileSync(path.join(reportDir, 'phase4a_cleanup_candidates.json'), JSON.stringify(candidates, null, 2));
fs.writeFileSync(path.join(reportDir, 'phase4a_usage_rows.json'), JSON.stringify(usageRows, null, 2));
fs.writeFileSync(path.join(reportDir, 'phase4a_filesystem_inventory.json'), JSON.stringify(filesystemRows, null, 2));

const approvalRows = candidates.filter(r => r.approvalRequired === 'yes');
fs.writeFileSync(path.join(reportDir, 'phase4a_approval_required_candidates.csv'), [columns.join(','), ...approvalRows.map(row => columns.map(c => csvEscape(row[c])).join(','))].join('\n') + '\n');

const summary = {
  runId,
  generatedAt: new Date().toISOString(),
  mode: 'read-only-non-destructive',
  database: dbName,
  targetsInspected: activeTargets,
  skippedTargets,
  totals: {
    mediaAssetRows: mediaAssets.length,
    filesystemFiles: filesystemRows.length,
    usageRows: usageRows.length,
    nodeMediaUsageRows: usageRows.filter(u => u.type === 'node_media').length,
    wordpressMediaUsageRows: usageRows.filter(u => u.type === 'wordpress_media').length,
    candidateRows: candidates.length,
    approvalRequiredRows: approvalRows.length
  },
  classificationCounts: summarizeCounts(candidates, 'classification'),
  recommendationCounts: summarizeCounts(candidates, 'recommendation'),
  safeguards: [
    'No database writes executed',
    'No filesystem writes, deletes, or moves executed',
    'No Media Library records deleted',
    'All cleanup rows remain approval-only until explicit row-level approval'
  ]
};
fs.writeFileSync(path.join(reportDir, 'phase4a_cleanup_inventory_summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
await conn.end();
