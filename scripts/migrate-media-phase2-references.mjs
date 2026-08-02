import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(new URL('/home/manus/cove-storefront/package.json', import.meta.url));
const mysql = require('mysql2/promise');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const verifyOnly = args.has('--verify-only');
const dryRun = !apply || verifyOnly;
const appRoot = '/home/manus/cove-storefront';
const approvalDir = process.env.PHASE2_APPROVAL_DIR || path.join(appRoot, 'scripts', 'media-phase2-approval-lists');
const publicRoot = path.join(appRoot, 'public');
const runId = `media-phase2-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const reportDir = path.join(appRoot, 'reports', runId);

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

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') {}
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const header = rows[0];
  return rows.slice(1).filter(r => r.some(v => v !== '')).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function readCsv(name) {
  const p = path.join(approvalDir, name);
  return parseCsv(fs.readFileSync(p, 'utf8'));
}

function stableStringifyValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function parseJsonMaybe(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function uniqueOrdered(items) {
  const out = [];
  const seen = new Set();
  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function isWordPressMigrationReference(value) {
  return typeof value === 'string' && (
    value.includes('coveinterior.com/wp-content/uploads/') ||
    value.startsWith('/media/wordpress-migration/')
  );
}

function containsAdminUploadReference(value) {
  if (Array.isArray(value)) return value.some(containsAdminUploadReference);
  return typeof value === 'string' && value.startsWith('/media/admin-uploads/');
}

function localPathForUrl(url) {
  if (!url || !url.startsWith('/media/')) return null;
  return path.join(publicRoot, url.replace(/^\//, ''));
}

function normalizeApprovedTargetUrl(url) {
  if (url === '/media/wordpress-migration/2022/08/BG-1024&') return '/media/wordpress-migration/2022/08/BG-1024x576-1.png';
  return url;
}

function isPlainUrlCandidate(url) {
  return !!url && /^https?:\/\//i.test(url) && !/[<>\n\r]/.test(url) && url.length < 1000;
}

function replacementVariants(url) {
  if (!isPlainUrlCandidate(url)) return [];
  const variants = new Set([url]);
  try { variants.add(decodeURI(url)); } catch {}
  variants.add(url.replace(/&/g, '&amp;'));
  variants.add(url.replace(/&amp;/g, '&'));
  return [...variants].filter(Boolean);
}

function replaceAllApproved(text, replacements) {
  let next = text;
  const hits = [];
  for (const rep of replacements) {
    for (const from of rep.fromVariants) {
      let count = 0;
      if (!from || from === rep.to) continue;
      while (next.includes(from)) {
        next = next.replace(from, rep.to);
        count++;
      }
      if (count) hits.push({ from, to: rep.to, count, filename: rep.filename });
    }
  }
  return { next, hits };
}

function sha(value) {
  return crypto.createHash('sha256').update(value ?? '').digest('hex');
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

const productRows = readCsv('approval_product_media_assignments.csv').map(r => ({ ...r, target_node_url: normalizeApprovedTargetUrl(r.target_node_url) }));
const categoryRows = readCsv('approval_category_media_assignments.csv').map(r => ({ ...r, target_node_url: normalizeApprovedTargetUrl(r.target_node_url) }));
const cmsRows = readCsv('approval_portfolio_page_cms_media_rewrites.csv').map(r => ({ ...r, target_node_url: normalizeApprovedTargetUrl(r.target_node_url) }));
const variationRows = readCsv('approval_variation_media_assignments.csv').map(r => ({ ...r, target_node_url: normalizeApprovedTargetUrl(r.target_node_url) }));

const approvedTargetUrls = uniqueOrdered([
  ...productRows.map(r => r.target_node_url),
  ...categoryRows.map(r => r.target_node_url),
  ...cmsRows.map(r => r.target_node_url),
]).filter(Boolean);

const missingFiles = approvedTargetUrls.filter(url => {
  const p = localPathForUrl(url);
  return !p || !fs.existsSync(p);
});
if (missingFiles.length) {
  throw new Error(`Refusing Phase 2 because ${missingFiles.length} approved target media files are missing. First missing: ${missingFiles[0]}`);
}

const replacements = [];
for (const r of cmsRows) {
  if (r.approval_action !== 'rewrite_embedded_media_url' || !r.target_node_url) continue;
  const variants = uniqueOrdered([...replacementVariants(r.old_wp_url), ...replacementVariants(r.canonical_url)]);
  if (r.canonical_url === 'https://coveinterior.com/wp-content/uploads/2022/08/BG-1024&') {
    variants.push('https://coveinterior.com/wp-content/uploads/2022/08/BG-1024&#215;576-1.png?id=9830');
    variants.push('https://coveinterior.com/wp-content/uploads/2022/08/BG-1024&#215;576-1.png');
    variants.push('https://coveinterior.com/wp-content/uploads/2022/08/BG-1024×576-1.png?id=9830');
    variants.push('https://coveinterior.com/wp-content/uploads/2022/08/BG-1024×576-1.png');
  }
  if (variants.length) replacements.push({ fromVariants: uniqueOrdered(variants), to: r.target_node_url, filename: r.filename, usageType: r.usage_type });
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);
const changes = [];
const skipped = [];

// Product gallery assignments: approved matched product rows only.
const productGroups = new Map();
for (const r of productRows) {
  if (r.match_status !== 'matched' || !r.node_product_id) continue;
  if (!productGroups.has(r.node_product_id)) productGroups.set(r.node_product_id, []);
  productGroups.get(r.node_product_id).push(r);
}
for (const [productId, rows] of productGroups) {
  rows.sort((a, b) => Number(a.gallery_position || 0) - Number(b.gallery_position || 0));
  const desiredImages = uniqueOrdered(rows.map(r => r.target_node_url).filter(Boolean));
  const [dbRows] = await conn.execute('SELECT id, images FROM products WHERE id = ?', [productId]);
  if (!dbRows.length) { skipped.push({ type: 'product', id: productId, reason: 'missing_product' }); continue; }
  const current = parseJsonMaybe(dbRows[0].images, []);
  const currentArray = Array.isArray(current) ? current : [];
  if (containsAdminUploadReference(currentArray)) { skipped.push({ type: 'product', id: productId, reason: 'existing_admin_upload_reference_not_overwritten' }); continue; }
  if (currentArray.length && !currentArray.every(isWordPressMigrationReference)) { skipped.push({ type: 'product', id: productId, reason: 'existing_non_wordpress_reference_not_overwritten' }); continue; }
  if (JSON.stringify(currentArray) !== JSON.stringify(desiredImages)) {
    changes.push({ table: 'products', id: productId, column: 'images', oldValue: JSON.stringify(currentArray), newValue: JSON.stringify(desiredImages), actionType: 'set_product_gallery', detail: { imageCount: desiredImages.length } });
  }
}

// Category image assignments: only matched category rows; blocked/no-match rows remain skipped.
for (const r of categoryRows) {
  if (r.match_status !== 'matched' || !r.node_category_id) { skipped.push({ type: 'category', id: r.wp_category_id, reason: r.match_status || 'not_matched' }); continue; }
  const [dbRows] = await conn.execute('SELECT id, image FROM categories WHERE id = ?', [r.node_category_id]);
  if (!dbRows.length) { skipped.push({ type: 'category', id: r.node_category_id, reason: 'missing_category' }); continue; }
  const current = dbRows[0].image ?? null;
  const desired = r.target_node_url;
  if (containsAdminUploadReference(current)) { skipped.push({ type: 'category', id: r.node_category_id, reason: 'existing_admin_upload_reference_not_overwritten' }); continue; }
  if (current && !isWordPressMigrationReference(current)) { skipped.push({ type: 'category', id: r.node_category_id, reason: 'existing_non_wordpress_reference_not_overwritten' }); continue; }
  if (current !== desired) {
    changes.push({ table: 'categories', id: r.node_category_id, column: 'image', oldValue: current, newValue: desired, actionType: 'set_category_image', detail: { slug: r.node_category_slug } });
  }
}

// CMS/page reference rewrites by exact approved URL replacement only.
const rewriteTargets = [
  { table: 'page_blocks', column: 'config' },
  { table: 'pages', column: 'puckData' },
  { table: 'homepage_sections', column: 'imageUrl' },
];
for (const target of rewriteTargets) {
  let rows = [];
  try {
    const [result] = await conn.execute(`SELECT id, \`${target.column}\` AS value FROM \`${target.table}\` WHERE \`${target.column}\` IS NOT NULL AND CAST(\`${target.column}\` AS CHAR) LIKE ?`, ['%coveinterior.com/wp-content/uploads/%']);
    rows = result;
  } catch (error) {
    skipped.push({ type: 'rewrite_target', table: target.table, column: target.column, reason: error.message });
    continue;
  }
  for (const row of rows) {
    const oldText = stableStringifyValue(row.value);
    const { next, hits } = replaceAllApproved(oldText, replacements);
    if (hits.length && next !== oldText) {
      changes.push({ table: target.table, id: row.id, column: target.column, oldValue: oldText, newValue: next, actionType: 'rewrite_approved_wp_media_urls', detail: { hits } });
    }
  }
}

const skippedVariations = variationRows.length;
skipped.push({ type: 'variation_assignments', count: skippedVariations, reason: 'not_applied_in_phase2_because_all_rows_are_multiple_node_variant_matches' });

const summary = {
  runId,
  startedAt: new Date().toISOString(),
  mode: apply ? 'apply' : verifyOnly ? 'verify-only' : 'dry-run',
  approvalDir,
  approvedRows: {
    product: productRows.length,
    category: categoryRows.length,
    cmsRewrite: cmsRows.length,
    variation: variationRows.length,
  },
  validatedTargetFiles: approvedTargetUrls.length,
  missingTargetFiles: missingFiles.length,
  proposedChanges: changes.length,
  proposedChangeCounts: changes.reduce((acc, c) => { const k = `${c.table}.${c.column}:${c.actionType}`; acc[k] = (acc[k] || 0) + 1; return acc; }, {}),
  skippedCount: skipped.length,
  skippedReasonCounts: skipped.reduce((acc, s) => { const k = s.reason || s.type; acc[k] = (acc[k] || 0) + (s.count || 1); return acc; }, {}),
};

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

summary.finishedAt = new Date().toISOString();
await conn.end();

fs.writeFileSync(path.join(reportDir, 'phase2_reference_summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(reportDir, 'phase2_reference_changes.json'), JSON.stringify(changes, null, 2));
fs.writeFileSync(path.join(reportDir, 'phase2_reference_skipped.json'), JSON.stringify(skipped, null, 2));
const csvHeader = ['table','id','column','actionType','oldSha256','newSha256','detail'];
const csvRows = [csvHeader.join(',')];
for (const c of changes) {
  const vals = [c.table, c.id, c.column, c.actionType, sha(c.oldValue), sha(c.newValue), JSON.stringify(c.detail || {})];
  csvRows.push(vals.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
}
fs.writeFileSync(path.join(reportDir, 'phase2_reference_changes.csv'), csvRows.join('\n') + '\n');
console.log(JSON.stringify(summary, null, 2));
