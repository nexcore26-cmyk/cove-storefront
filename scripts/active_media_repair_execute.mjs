import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(new URL('/home/manus/cove-storefront/package.json', import.meta.url));
const mysql = require('mysql2/promise');

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const dryRun = !apply || args.has('--dry-run');
const appRoot = '/home/manus/cove-storefront';
const publicRoot = path.join(appRoot, 'public');
const runId = `active-media-repair-${new Date().toISOString().replace(/[:.]/g, '-')}`;
const reportDir = path.join(appRoot, 'reports', runId);
const planCsv = process.env.ACTIVE_MEDIA_REPAIR_PLAN_CSV || path.join(appRoot, 'scripts', 'active_media_repair_plan.csv');
const stagedSourceRoot = process.env.ACTIVE_MEDIA_REPAIR_SOURCE_ROOT || path.join(appRoot, 'scripts', 'active_media_repair_sources');
const expectedRows = Number(process.env.ACTIVE_MEDIA_REPAIR_EXPECTED_ROWS || 88);
const expectedRestores = Number(process.env.ACTIVE_MEDIA_REPAIR_EXPECTED_RESTORES || 88);
const expectedDbFixes = Number(process.env.ACTIVE_MEDIA_REPAIR_EXPECTED_DB_FIXES || 0);

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
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function safeMediaUrl(url) {
  if (!url || !url.startsWith('/media/wordpress-migration/')) throw new Error(`Unsafe media URL: ${url}`);
  const rel = url.replace(/^\//, '');
  if (rel.includes('..') || path.isAbsolute(rel)) throw new Error(`Unsafe relative media path: ${url}`);
  return rel;
}

function urlToPublicPath(url) {
  return path.join(publicRoot, safeMediaUrl(url));
}

function urlToStagedSourcePath(url) {
  return path.join(stagedSourceRoot, safeMediaUrl(url));
}

function parseRefs(refs) {
  return String(refs || '').split(';').filter(Boolean).map(ref => {
    const m = ref.match(/^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)#(.+)$/);
    if (!m) throw new Error(`Unparseable reference: ${ref}`);
    return { table: m[1], column: m[2], id: m[3] };
  });
}

function removeExactUrl(value, targetUrl) {
  let removed = 0;
  if (value === null || value === undefined) return { value, removed, changed: false, representation: 'null' };
  if (typeof value !== 'string') {
    const result = removeFromAny(value, targetUrl);
    return { value: result.value, removed: result.removed, changed: result.removed > 0, representation: 'json' };
  }
  const trimmed = value.trim();
  if (!trimmed) return { value, removed, changed: false, representation: 'empty_string' };
  try {
    const parsed = JSON.parse(trimmed);
    const result = removeFromAny(parsed, targetUrl);
    if (result.removed > 0) return { value: JSON.stringify(result.value), removed: result.removed, changed: true, representation: 'json_string' };
  } catch {}
  if (trimmed === targetUrl) return { value: null, removed: 1, changed: true, representation: 'plain_string_exact' };
  return { value, removed: 0, changed: false, representation: 'plain_string_no_match' };
}

function removeFromAny(value, targetUrl) {
  if (Array.isArray(value)) {
    let removed = 0;
    const out = [];
    for (const item of value) {
      if (item === targetUrl) { removed++; continue; }
      const child = removeFromAny(item, targetUrl);
      removed += child.removed;
      out.push(child.value);
    }
    return { value: out, removed };
  }
  if (value && typeof value === 'object') {
    let removed = 0;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (v === targetUrl) { removed++; continue; }
      const child = removeFromAny(v, targetUrl);
      removed += child.removed;
      out[k] = child.value;
    }
    return { value: out, removed };
  }
  return { value, removed: 0 };
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Date) value = value.toISOString().slice(0, 19).replace('T', ' ');
  if (typeof value === 'object') value = JSON.stringify(value);
  return mysql.escape(String(value));
}

function restoreUpdateSql(rows) {
  if (!rows.length) return '-- No database rows were modified.\n';
  return rows.map(r => `UPDATE \`${r.table}\` SET \`${r.column}\` = ${sqlLiteral(r.beforeValue)} WHERE \`id\` = ${sqlLiteral(r.id)};`).join('\n') + '\n';
}

async function tableColumns(conn) {
  const [dbRows] = await conn.execute('SELECT DATABASE() AS dbName');
  const dbName = dbRows[0].dbName;
  const [cols] = await conn.execute('SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ?', [dbName]);
  return { dbName, set: new Set(cols.map(r => `${r.tableName}.${r.columnName}`)) };
}

function summarize(rows, key) {
  return rows.reduce((acc, r) => { const k = r[key] || ''; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
}

async function inspectDbFixes(conn, dbRows) {
  const checks = [];
  const blockers = [];
  for (const repair of dbRows) {
    const refs = parseRefs(repair.referenced_at);
    for (const ref of refs) {
      if (!['products', 'categories', 'product_variants'].includes(ref.table)) {
        blockers.push({ type: 'unsupported_db_fix_table', repairId: repair.repair_id, ref });
        continue;
      }
      if (!['images', 'image', 'galleryImages'].includes(ref.column)) {
        blockers.push({ type: 'unsupported_db_fix_column', repairId: repair.repair_id, ref });
        continue;
      }
      const [found] = await conn.execute(`SELECT \`${ref.column}\` AS value FROM \`${ref.table}\` WHERE \`id\` = ? LIMIT 1`, [ref.id]);
      if (found.length !== 1) {
        blockers.push({ type: 'db_fix_record_not_found', repairId: repair.repair_id, ref, found: found.length });
        continue;
      }
      const beforeValue = found[0].value;
      const changed = removeExactUrl(beforeValue, repair.url);
      checks.push({ repairId: repair.repair_id, url: repair.url, ...ref, beforeValue, afterValue: changed.value, removedCount: changed.removed, changed: changed.changed, representation: changed.representation });
      if (!changed.changed || changed.removed < 1) blockers.push({ type: 'db_fix_target_url_not_found_in_record', repairId: repair.repair_id, url: repair.url, ref, representation: changed.representation });
    }
  }
  return { checks, blockers };
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
const planRows = parseCsv(fs.readFileSync(planCsv, 'utf8'));
const restoreRows = planRows.filter(r => r.repair_status === 'ready_for_restore');
const dbFixRows = planRows.filter(r => r.repair_status === 'requires_db_reference_fix');
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const summary = {
  runId,
  startedAt: new Date().toISOString(),
  mode: apply ? 'apply' : 'dry-run',
  planCsv,
  stagedSourceRoot,
  expectedRows,
  expectedRestores,
  expectedDbFixes,
  planRows: planRows.length,
  counts: {
    byRepairStatus: summarize(planRows, 'repair_status'),
    byRepairAction: summarize(planRows, 'repair_action')
  },
  safeguards: [
    'The repair plan must contain exactly 88 confirmed file restore rows; parser false positives are excluded from apply scope.',
    'Every file restore must target /home/manus/cove-storefront/public/media/wordpress-migration/ only.',
    'Every staged source file must exist before apply mode starts.',
    'Destination files must be absent before restore; existing files are never overwritten.',
    'Malformed database cleanup removes only exact URL values from specified rows and columns.',
    'Affected database rows are backed up to JSON and SQL restore files before update.',
    'Database updates are executed inside a transaction.',
    'Post-apply verification checks filesystem, database references, and public media URL responses.'
  ]
};

try {
  const { dbName, set: columnSet } = await tableColumns(conn);
  summary.database = dbName;
  const blockers = [];
  const warnings = [];
  if (planRows.length !== expectedRows) blockers.push({ type: 'unexpected_plan_row_count', expectedRows, actualRows: planRows.length });
  if (restoreRows.length !== expectedRestores) blockers.push({ type: 'unexpected_restore_row_count', expectedRestores, actualRows: restoreRows.length });
  if (dbFixRows.length !== expectedDbFixes) blockers.push({ type: 'unexpected_db_fix_row_count', expectedDbFixes, actualRows: dbFixRows.length });

  const restoreChecks = [];
  const seenUrls = new Set();
  for (const row of restoreRows) {
    let rel = '';
    try { rel = safeMediaUrl(row.url); } catch (error) { blockers.push({ type: 'unsafe_restore_url', repairId: row.repair_id, url: row.url, error: error.message }); continue; }
    if (seenUrls.has(row.url)) blockers.push({ type: 'duplicate_restore_url', repairId: row.repair_id, url: row.url });
    seenUrls.add(row.url);
    const staged = urlToStagedSourcePath(row.url);
    const dest = urlToPublicPath(row.url);
    const sourceExists = fs.existsSync(staged) && fs.statSync(staged).isFile();
    const destExists = fs.existsSync(dest);
    const sourceSize = sourceExists ? fs.statSync(staged).size : null;
    restoreChecks.push({ repairId: row.repair_id, url: row.url, rel, staged, dest, sourceExists, destExists, sourceSize, sourceSha256: sourceExists ? shaFile(staged) : '' });
    if (!sourceExists) blockers.push({ type: 'staged_source_missing', repairId: row.repair_id, url: row.url, staged });
    if (destExists) blockers.push({ type: 'destination_already_exists_refusing_overwrite', repairId: row.repair_id, url: row.url, dest });
    if (!dest.startsWith(path.join(publicRoot, 'media', 'wordpress-migration') + path.sep)) blockers.push({ type: 'destination_outside_allowed_scope', repairId: row.repair_id, url: row.url, dest });
  }

  const dbInspection = await inspectDbFixes(conn, dbFixRows);
  blockers.push(...dbInspection.blockers);
  const missingColumns = [];
  for (const c of ['products.id','products.images','categories.id','categories.image','product_variants.id','product_variants.galleryImages']) {
    if (!columnSet.has(c)) missingColumns.push(c);
  }
  if (missingColumns.length) warnings.push({ type: 'expected_columns_missing_or_not_needed', missingColumns });

  fs.writeFileSync(path.join(reportDir, 'active_media_repair_restore_checks.json'), JSON.stringify(restoreChecks, null, 2));
  fs.writeFileSync(path.join(reportDir, 'active_media_repair_db_fix_inspection.json'), JSON.stringify(dbInspection.checks, null, 2));
  fs.writeFileSync(path.join(reportDir, 'active_media_repair_blockers.json'), JSON.stringify(blockers, null, 2));
  fs.writeFileSync(path.join(reportDir, 'active_media_repair_warnings.json'), JSON.stringify(warnings, null, 2));

  summary.preflight = {
    blockers: blockers.length,
    warnings: warnings.length,
    restoreChecks: restoreChecks.length,
    dbFixChecks: dbInspection.checks.length,
    sourceFilesPresent: restoreChecks.filter(r => r.sourceExists).length,
    destinationsAlreadyPresent: restoreChecks.filter(r => r.destExists).length,
    dbFixReferencesRemovable: dbInspection.checks.filter(r => r.changed).length
  };

  if (blockers.length) throw new Error(`Refusing active-media repair because preflight found ${blockers.length} blocker(s).`);

  if (dryRun) {
    summary.applied = false;
    summary.reason = 'dry_run_mode';
  } else {
    const rollbackDir = path.join(reportDir, 'rollback');
    fs.mkdirSync(rollbackDir, { recursive: true });
    const fileRestores = [];
    for (const check of restoreChecks) {
      fs.mkdirSync(path.dirname(check.dest), { recursive: true });
      fs.copyFileSync(check.staged, check.dest, fs.constants.COPYFILE_EXCL);
      const destSha256 = shaFile(check.dest);
      fileRestores.push({ ...check, restored: true, destSize: fs.statSync(check.dest).size, destSha256, verified: destSha256 === check.sourceSha256 });
      if (destSha256 !== check.sourceSha256) throw new Error(`Restored file hash mismatch for ${check.url}`);
    }
    fs.writeFileSync(path.join(reportDir, 'active_media_repair_file_restores.json'), JSON.stringify(fileRestores, null, 2));

    fs.writeFileSync(path.join(reportDir, 'rollback_db_rows_before_update.json'), JSON.stringify(dbInspection.checks, null, 2));
    fs.writeFileSync(path.join(reportDir, 'rollback_db_restore_updates.sql'), restoreUpdateSql(dbInspection.checks));
    const dbUpdates = [];
    await conn.beginTransaction();
    try {
      for (const check of dbInspection.checks) {
        const [result] = await conn.execute(`UPDATE \`${check.table}\` SET \`${check.column}\` = ? WHERE \`id\` = ?`, [check.afterValue, check.id]);
        dbUpdates.push({ repairId: check.repairId, url: check.url, table: check.table, column: check.column, id: check.id, affectedRows: result.affectedRows, removedCount: check.removedCount });
        if (result.affectedRows !== 1) throw new Error(`Unexpected DB update count ${result.affectedRows} for ${check.table}.${check.column}#${check.id}`);
      }
      await conn.commit();
    } catch (error) {
      await conn.rollback();
      throw error;
    }
    fs.writeFileSync(path.join(reportDir, 'active_media_repair_db_updates.json'), JSON.stringify(dbUpdates, null, 2));

    const postFileChecks = [];
    for (const row of restoreRows) {
      const dest = urlToPublicPath(row.url);
      postFileChecks.push({ repairId: row.repair_id, url: row.url, dest, exists: fs.existsSync(dest), size: fs.existsSync(dest) ? fs.statSync(dest).size : null, sha256: fs.existsSync(dest) ? shaFile(dest) : '' });
    }
    fs.writeFileSync(path.join(reportDir, 'active_media_repair_post_file_checks.json'), JSON.stringify(postFileChecks, null, 2));

    const postDbInspection = await inspectDbFixes(conn, dbFixRows);
    fs.writeFileSync(path.join(reportDir, 'active_media_repair_post_db_fix_inspection.json'), JSON.stringify(postDbInspection.checks, null, 2));

    const httpChecks = [];
    for (const row of restoreRows) httpChecks.push(await headUrl(row.url));
    fs.writeFileSync(path.join(reportDir, 'active_media_repair_post_http_checks.json'), JSON.stringify(httpChecks, null, 2));
    const httpCols = ['url','httpUrl','ok','status','contentLength','contentType','error'];
    fs.writeFileSync(path.join(reportDir, 'active_media_repair_post_http_checks.csv'), [httpCols.join(','), ...httpChecks.map(r => httpCols.map(c => csvEscape(r[c])).join(','))].join('\n') + '\n');

    summary.applied = true;
    summary.repaired = {
      filesRestored: fileRestores.filter(r => r.restored && r.verified).length,
      fileRestoreFailures: fileRestores.filter(r => !r.verified).length,
      dbRowsUpdated: dbUpdates.reduce((sum, r) => sum + r.affectedRows, 0),
      dbUrlOccurrencesRemoved: dbUpdates.reduce((sum, r) => sum + Number(r.removedCount || 0), 0),
      restoredFilesPresentAfter: postFileChecks.filter(r => r.exists).length,
      malformedRefsRemainingAfter: postDbInspection.checks.filter(r => r.changed).length,
      postHttpOk: httpChecks.filter(r => r.ok).length,
      postHttpNonOk: httpChecks.filter(r => !r.ok).length,
      postHttpImageOrMedia: httpChecks.filter(r => String(r.contentType).startsWith('image/') || String(r.contentType).startsWith('video/')).length
    };
  }
} catch (error) {
  summary.error = error.message;
  summary.failed = true;
  process.exitCode = 1;
} finally {
  summary.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(reportDir, 'active_media_repair_summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(reportDir, 'active_media_repair_plan_snapshot.csv'), fs.readFileSync(planCsv, 'utf8'));
  await conn.end();
  console.log(JSON.stringify(summary, null, 2));
}
