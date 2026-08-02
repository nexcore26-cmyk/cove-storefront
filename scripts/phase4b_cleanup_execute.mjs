import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(new URL('/home/manus/cove-storefront/package.json', import.meta.url));
const mysql = require('mysql2/promise');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const preflightOnly = args.has('--preflight-only') || !apply;
const appRoot = '/home/manus/cove-storefront';
const publicRoot = path.join(appRoot, 'public');
const runId = `media-phase4b-cleanup-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const reportDir = path.join(appRoot, 'reports', runId);
const approvalCsv = process.env.PHASE4B_APPROVAL_CSV || path.join(appRoot, 'scripts', 'phase4b_approval_ready_candidates.csv');
const expectedRows = Number(process.env.PHASE4B_EXPECTED_ROWS || 189);

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

function csvEscape(v) {
  return '"' + String(v ?? '').replace(/"/g, '""') + '"';
}

function shaFile(filePath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  hash.update(data);
  return hash.digest('hex');
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

function urlToPublicPath(url) {
  if (!url || !url.startsWith('/media/')) return '';
  return path.join(publicRoot, url.replace(/^\//, ''));
}

function safeRelativeMediaPath(url) {
  if (!url || !url.startsWith('/media/')) throw new Error(`Unsafe media URL: ${url}`);
  const rel = url.replace(/^\//, '');
  if (rel.includes('..') || path.isAbsolute(rel)) throw new Error(`Unsafe relative path: ${url}`);
  return rel;
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Date) value = value.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof value === 'object') value = JSON.stringify(value);
  return mysql.escape(String(value));
}

function backupInsertSql(table, rows) {
  if (!rows.length) return `-- No ${table} rows were backed up.\n`;
  const cols = Object.keys(rows[0]);
  const colSql = cols.map(c => `\`${c}\``).join(', ');
  const values = rows.map(row => `(${cols.map(c => sqlLiteral(row[c])).join(', ')})`).join(',\n');
  return `-- Restore media_assets rows for ${runId}\nINSERT INTO \`${table}\` (${colSql}) VALUES\n${values};\n`;
}

function summarizeCounts(rows, key) {
  return rows.reduce((acc, row) => {
    const k = row[key] ?? '';
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
}

async function tableColumns(conn) {
  const [dbRows] = await conn.execute('SELECT DATABASE() AS dbName');
  const dbName = dbRows[0].dbName;
  const [cols] = await conn.execute(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ?`,
    [dbName]
  );
  return { dbName, cols, set: new Set(cols.map(r => `${r.tableName}.${r.columnName}`)) };
}

async function collectUsage(conn, columnSet) {
  const activeTargets = referenceTargets
    .map(t => ({ ...t, columns: t.columns.filter(c => columnSet.has(`${t.table}.${c}`)) }))
    .filter(t => t.columns.length && columnSet.has(`${t.table}.${t.id}`));
  const usageRows = [];
  const skippedTargets = [];
  for (const target of activeTargets) {
    const cols = [target.id, ...target.columns];
    let rows = [];
    try {
      const [result] = await conn.execute(`SELECT ${cols.map(c => `\`${c}\``).join(', ')} FROM \`${target.table}\``);
      rows = result;
    } catch (error) {
      skippedTargets.push({ target, error: error.message });
      continue;
    }
    for (const row of rows) {
      for (const column of target.columns) {
        for (const url of extractNodeMediaUrls(row[column])) {
          usageRows.push({ url, tableName: target.table, columnName: column, recordId: String(row[target.id]), usageClass: target.usageClass });
        }
      }
    }
  }
  return { activeTargets, usageRows, skippedTargets };
}

async function preflight(conn, approvalRows, columnSet) {
  const blockers = [];
  const warnings = [];
  const seenCandidateIds = new Set();
  const seenUrls = new Set();

  if (approvalRows.length !== expectedRows) blockers.push({ type: 'unexpected_row_count', expectedRows, actualRows: approvalRows.length });

  for (const row of approvalRows) {
    if (seenCandidateIds.has(row.candidateId)) blockers.push({ type: 'duplicate_candidate_id', candidateId: row.candidateId });
    seenCandidateIds.add(row.candidateId);
    if (seenUrls.has(row.url)) blockers.push({ type: 'duplicate_url', url: row.url });
    seenUrls.add(row.url);
    if (row.approvalRequired !== 'yes') blockers.push({ type: 'approval_required_not_yes', candidateId: row.candidateId, approvalRequired: row.approvalRequired });
    if (!row.url?.startsWith('/media/wordpress-migration/')) blockers.push({ type: 'url_outside_wordpress_migration_scope', candidateId: row.candidateId, url: row.url });
    if (!['cleanup_candidate_review_only', 'filesystem_only_review_only'].includes(row.classification)) blockers.push({ type: 'unapproved_classification', candidateId: row.candidateId, classification: row.classification });
    if (!['media_asset', 'filesystem_file'].includes(row.kind)) blockers.push({ type: 'unapproved_kind', candidateId: row.candidateId, kind: row.kind });
    if (row.kind === 'media_asset' && !row.mediaAssetId) blockers.push({ type: 'missing_media_asset_id', candidateId: row.candidateId });
  }

  const { activeTargets, usageRows, skippedTargets } = await collectUsage(conn, columnSet);
  const usageByUrl = new Map();
  for (const u of usageRows) {
    if (!usageByUrl.has(u.url)) usageByUrl.set(u.url, []);
    usageByUrl.get(u.url).push(u);
  }

  const rowChecks = [];
  for (const row of approvalRows) {
    const expectedPath = urlToPublicPath(row.url);
    const fsExists = fs.existsSync(expectedPath);
    const st = fsExists ? fs.statSync(expectedPath) : null;
    const fileSizeMatchesCsv = st && String(st.size) === String(row.fileSizeBytes || '');
    const usages = usageByUrl.get(row.url) || [];
    const check = {
      candidateId: row.candidateId,
      kind: row.kind,
      mediaAssetId: row.mediaAssetId,
      url: row.url,
      expectedPath,
      fsExists,
      actualFileSizeBytes: st?.size ?? null,
      approvedFileSizeBytes: row.fileSizeBytes || '',
      fileSizeMatchesCsv: !!fileSizeMatchesCsv,
      usageCountTotal: usages.length,
      usageCountCommerceActive: usages.filter(u => u.usageClass === 'commerce_active').length,
      usageCountCmsActive: usages.filter(u => u.usageClass === 'cms_active').length,
      usageCountHistoricalOrder: usages.filter(u => u.usageClass === 'historical_order_snapshot').length,
      referencedAt: usages.map(u => `${u.tableName}.${u.columnName}#${u.recordId}`).join(';')
    };

    if (!fsExists) blockers.push({ type: 'approved_file_missing_before_cleanup', candidateId: row.candidateId, url: row.url, expectedPath });
    if (fsExists && !fileSizeMatchesCsv) blockers.push({ type: 'approved_file_size_mismatch', candidateId: row.candidateId, url: row.url, approvedFileSizeBytes: row.fileSizeBytes, actualFileSizeBytes: st.size });
    if (usages.length) blockers.push({ type: 'approved_url_now_referenced', candidateId: row.candidateId, url: row.url, usages });

    if (row.kind === 'media_asset') {
      const [dbRows] = await conn.execute('SELECT * FROM media_assets WHERE id = ? LIMIT 2', [row.mediaAssetId]);
      check.mediaAssetRowsFound = dbRows.length;
      check.mediaAssetUrlMatches = dbRows.length === 1 && dbRows[0].url === row.url;
      if (dbRows.length !== 1) blockers.push({ type: 'media_asset_row_count_not_one', candidateId: row.candidateId, mediaAssetId: row.mediaAssetId, rowsFound: dbRows.length });
      else if (dbRows[0].url !== row.url) blockers.push({ type: 'media_asset_url_mismatch', candidateId: row.candidateId, mediaAssetId: row.mediaAssetId, approvedUrl: row.url, actualUrl: dbRows[0].url });
    } else if (row.kind === 'filesystem_file') {
      const [dbRows] = await conn.execute('SELECT id, url FROM media_assets WHERE url = ? LIMIT 5', [row.url]);
      check.mediaAssetRowsFound = dbRows.length;
      if (dbRows.length) blockers.push({ type: 'filesystem_only_now_has_media_asset_row', candidateId: row.candidateId, url: row.url, mediaAssetRows: dbRows });
    }
    rowChecks.push(check);
  }

  return { blockers, warnings, activeTargets, skippedTargets, usageRows, rowChecks };
}

async function headUrl(url) {
  const absolute = `https://app.coveinterior.com${url}`;
  try {
    const encoded = new URL(absolute);
    encoded.pathname = encoded.pathname.split('/').map(s => encodeURIComponent(decodeURIComponent(s))).join('/');
    const res = await fetch(encoded.toString(), { method: 'HEAD', redirect: 'manual' });
    return { url, httpUrl: encoded.toString(), ok: res.ok, status: res.status, contentLength: res.headers.get('content-length') || '', contentType: res.headers.get('content-type') || '', error: '' };
  } catch (error) {
    return { url, httpUrl: absolute, ok: false, status: null, contentLength: '', contentType: '', error: error.message };
  }
}

loadEnv();
fs.mkdirSync(reportDir, { recursive: true });
const approvalRows = parseCsv(fs.readFileSync(approvalCsv, 'utf8'));
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const summary = {
  runId,
  startedAt: new Date().toISOString(),
  mode: apply ? 'apply' : 'preflight-only',
  approvalCsv,
  expectedRows,
  approvedRows: approvalRows.length,
  rowCounts: {
    byKind: summarizeCounts(approvalRows, 'kind'),
    byClassification: summarizeCounts(approvalRows, 'classification')
  },
  safeguards: [
    'CSV approval list must contain exactly the expected row count.',
    'Every row must be approvalRequired=yes and remain inside /media/wordpress-migration/.',
    'Every approved URL must have zero detected commerce, CMS, or historical order references at preflight time.',
    'Media Library deletion candidates must still have exactly one matching media_assets row by id and URL.',
    'Filesystem-only candidates must still have no media_assets row for the approved URL.',
    'Every approved file is copied into a rollback directory and hashed before deletion.',
    'Media Library row backups are written to JSON and SQL restore files before any DELETE statement.',
    'Database deletions are performed inside a transaction with id+url predicates.'
  ]
};

let pre = null;
try {
  const { dbName, set: columnSet } = await tableColumns(conn);
  summary.database = dbName;
  pre = await preflight(conn, approvalRows, columnSet);
  summary.preflight = {
    blockers: pre.blockers.length,
    warnings: pre.warnings.length,
    activeTargets: pre.activeTargets,
    skippedTargets: pre.skippedTargets,
    usageRowsDetected: pre.usageRows.length,
    approvedRowsWithReferences: pre.rowChecks.filter(r => r.usageCountTotal > 0).length,
    approvedRowsMissingFiles: pre.rowChecks.filter(r => !r.fsExists).length,
    approvedRowsWithFileSizeMismatch: pre.rowChecks.filter(r => !r.fileSizeMatchesCsv).length
  };
  fs.writeFileSync(path.join(reportDir, 'phase4b_preflight_row_checks.json'), JSON.stringify(pre.rowChecks, null, 2));
  fs.writeFileSync(path.join(reportDir, 'phase4b_preflight_blockers.json'), JSON.stringify(pre.blockers, null, 2));
  fs.writeFileSync(path.join(reportDir, 'phase4b_preflight_warnings.json'), JSON.stringify(pre.warnings, null, 2));

  if (pre.blockers.length) throw new Error(`Refusing Phase 4B because preflight found ${pre.blockers.length} blocker(s).`);

  if (preflightOnly) {
    summary.applied = false;
    summary.reason = 'preflight_only_mode';
  } else {
    const backupDir = path.join(reportDir, 'rollback_files');
    const mediaBackupDir = path.join(backupDir, 'public_media');
    fs.mkdirSync(mediaBackupDir, { recursive: true });
    const mediaAssetRows = [];
    for (const row of approvalRows.filter(r => r.kind === 'media_asset')) {
      const [dbRows] = await conn.execute('SELECT * FROM media_assets WHERE id = ? AND url = ? LIMIT 1', [row.mediaAssetId, row.url]);
      mediaAssetRows.push(dbRows[0]);
    }
    fs.writeFileSync(path.join(reportDir, 'rollback_media_assets_rows.json'), JSON.stringify(mediaAssetRows, null, 2));
    fs.writeFileSync(path.join(reportDir, 'rollback_media_assets_restore.sql'), backupInsertSql('media_assets', mediaAssetRows));

    const fileBackups = [];
    for (const row of approvalRows) {
      const rel = safeRelativeMediaPath(row.url);
      const src = path.join(publicRoot, rel);
      const dest = path.join(mediaBackupDir, rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const beforeSha256 = shaFile(src);
      fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL);
      const backupSha256 = shaFile(dest);
      fileBackups.push({ candidateId: row.candidateId, kind: row.kind, url: row.url, sourcePath: src, backupPath: dest, sizeBytes: fs.statSync(src).size, beforeSha256, backupSha256, backupVerified: beforeSha256 === backupSha256 });
      if (beforeSha256 !== backupSha256) throw new Error(`Backup hash mismatch for ${row.url}`);
    }
    fs.writeFileSync(path.join(reportDir, 'rollback_file_backups.json'), JSON.stringify(fileBackups, null, 2));

    const dbDeletes = [];
    await conn.beginTransaction();
    try {
      for (const row of approvalRows.filter(r => r.kind === 'media_asset')) {
        const [result] = await conn.execute('DELETE FROM media_assets WHERE id = ? AND url = ?', [row.mediaAssetId, row.url]);
        dbDeletes.push({ candidateId: row.candidateId, mediaAssetId: row.mediaAssetId, url: row.url, affectedRows: result.affectedRows });
        if (result.affectedRows !== 1) throw new Error(`Unexpected media_assets delete count ${result.affectedRows} for ${row.candidateId}`);
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    }
    fs.writeFileSync(path.join(reportDir, 'phase4b_db_deletions.json'), JSON.stringify(dbDeletes, null, 2));

    const fileDeletes = [];
    for (const row of approvalRows) {
      const filePath = urlToPublicPath(row.url);
      try {
        fs.unlinkSync(filePath);
        fileDeletes.push({ candidateId: row.candidateId, kind: row.kind, url: row.url, path: filePath, deleted: true, error: '' });
      } catch (error) {
        fileDeletes.push({ candidateId: row.candidateId, kind: row.kind, url: row.url, path: filePath, deleted: false, error: error.message });
      }
    }
    fs.writeFileSync(path.join(reportDir, 'phase4b_file_deletions.json'), JSON.stringify(fileDeletes, null, 2));

    const postRowChecks = [];
    for (const row of approvalRows) {
      const filePath = urlToPublicPath(row.url);
      const [dbRows] = await conn.execute('SELECT id, url FROM media_assets WHERE url = ? OR id = ? LIMIT 10', [row.url, row.mediaAssetId || 0]);
      postRowChecks.push({ candidateId: row.candidateId, kind: row.kind, mediaAssetId: row.mediaAssetId, url: row.url, fileExistsAfterDelete: fs.existsSync(filePath), mediaAssetRowsRemaining: dbRows.length, remainingMediaAssetRows: dbRows });
    }
    fs.writeFileSync(path.join(reportDir, 'phase4b_post_delete_row_checks.json'), JSON.stringify(postRowChecks, null, 2));

    const postHttp = [];
    for (const row of approvalRows) postHttp.push(await headUrl(row.url));
    fs.writeFileSync(path.join(reportDir, 'phase4b_post_delete_http_checks.json'), JSON.stringify(postHttp, null, 2));
    const httpCsvCols = ['url','httpUrl','ok','status','contentLength','contentType','error'];
    fs.writeFileSync(path.join(reportDir, 'phase4b_post_delete_http_checks.csv'), [httpCsvCols.join(','), ...postHttp.map(r => httpCsvCols.map(c => csvEscape(r[c])).join(','))].join('\n') + '\n');

    summary.applied = true;
    summary.deleted = {
      mediaAssetRows: dbDeletes.filter(r => r.affectedRows === 1).length,
      filesystemFiles: fileDeletes.filter(r => r.deleted).length,
      fileDeleteFailures: fileDeletes.filter(r => !r.deleted).length,
      remainingFiles: postRowChecks.filter(r => r.fileExistsAfterDelete).length,
      remainingMediaAssetRows: postRowChecks.reduce((acc, r) => acc + r.mediaAssetRowsRemaining, 0),
      postDeleteHttp200: postHttp.filter(r => r.status === 200).length,
      postDeleteHttpNon200: postHttp.filter(r => r.status !== 200).length
    };
  }
} catch (error) {
  summary.error = error.message;
  summary.failed = true;
  process.exitCode = 1;
} finally {
  summary.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(reportDir, 'phase4b_cleanup_summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(reportDir, 'phase4b_approval_input_snapshot.csv'), fs.readFileSync(approvalCsv, 'utf8'));
  await conn.end();
  console.log(JSON.stringify(summary, null, 2));
}
