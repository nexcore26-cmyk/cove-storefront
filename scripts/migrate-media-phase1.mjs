#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const require = createRequire(new URL('../package.json', import.meta.url));
const mysql = require('mysql2/promise');

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = rawLine.indexOf('=');
    const key = rawLine.slice(0, idx).trim();
    let value = rawLine.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch === '\r') {
      // ignore; handled by \n
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift();
  if (!header) return [];
  return rows.filter(r => r.some(v => String(v || '').trim() !== '')).map(values => {
    const obj = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = values[i] ?? '';
    return obj;
  });
}

function mimeFromFilename(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif',
    '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.mp4': 'video/mp4',
    '.mov': 'video/quicktime', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
  };
  return map[ext] || 'application/octet-stream';
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, { redirect: 'follow', headers: { 'user-agent': 'CoveMediaPhase1Importer/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      return { buffer, contentType: res.headers.get('content-type') || '' };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw lastError;
}

async function verifyUrl(url) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'CoveMediaPhase1Verifier/1.0' } });
    // Consume a tiny amount where possible so the connection closes cleanly.
    await res.arrayBuffer();
    return { ok: res.status === 200, status: res.status, contentType: res.headers.get('content-type') || '', contentLength: res.headers.get('content-length') || '' };
  } catch (error) {
    return { ok: false, status: 0, contentType: '', contentLength: '', error: error.message };
  }
}

async function main() {
  loadEnv(path.join(appRoot, '.env'));
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL missing from environment');

  const args = new Map();
  for (const arg of process.argv.slice(2)) {
    const [k, ...rest] = arg.split('=');
    args.set(k, rest.length ? rest.join('=') : 'true');
  }

  const csvPath = path.resolve(args.get('--csv') || path.join(appRoot, 'scripts', 'approval_files_to_import.csv'));
  const publicMediaRoot = path.resolve(args.get('--media-root') || path.join(appRoot, 'public', 'media'));
  const baseUrl = String(args.get('--base-url') || 'https://app.coveinterior.com').replace(/\/$/, '');
  const tenantId = Number(args.get('--tenant-id') || 1);
  const dryRun = args.has('--dry-run');
  const verifyOnly = args.has('--verify-only');
  const limit = args.has('--limit') ? Number(args.get('--limit')) : 0;
  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, '-');
  const reportDir = path.resolve(args.get('--report-dir') || path.join(appRoot, 'reports', `media-phase1-${stamp}`));

  const rows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
  const selectedRows = limit > 0 ? rows.slice(0, limit) : rows;
  fs.mkdirSync(reportDir, { recursive: true });

  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const results = [];
  let imported = 0, reusedFile = 0, createdRecord = 0, updatedRecord = 0, reusedRecord = 0, failed = 0, verifiedOk = 0, verifiedFailed = 0;

  for (let index = 0; index < selectedRows.length; index++) {
    const row = selectedRows[index];
    const sourceUrl = row.canonical_url;
    const key = String(row.local_key || '').replace(/^\/media\//, '').replace(/^\//, '');
    const url = row.local_url || `/media/${key}`;
    const filename = row.filename || path.basename(key);
    const destPath = path.join(publicMediaRoot, key);
    const item = { index: index + 1, sourceUrl, key, url, filename, destPath, action: '', fileStatus: '', dbStatus: '', verifyStatus: '', httpStatus: '', sizeBytes: '', sha256: '', mediaAssetId: '', error: '' };

    try {
      if (!sourceUrl || !key || !url) throw new Error('Required CSV fields missing');
      let buffer;
      let contentType = '';
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
        buffer = fs.readFileSync(destPath);
        item.fileStatus = 'existing_local_file_reused';
        reusedFile++;
      } else if (!verifyOnly) {
        const downloaded = await fetchWithRetry(sourceUrl);
        buffer = downloaded.buffer;
        contentType = downloaded.contentType.split(';')[0].trim();
        if (!dryRun) {
          fs.mkdirSync(path.dirname(destPath), { recursive: true });
          fs.writeFileSync(destPath + '.tmp', buffer);
          fs.renameSync(destPath + '.tmp', destPath);
        }
        item.fileStatus = dryRun ? 'would_download' : 'downloaded';
        imported++;
      } else {
        throw new Error('Local file missing during verify-only mode');
      }

      const sizeBytes = buffer.length;
      const fileSha = sha256(buffer);
      const mimeType = contentType || mimeFromFilename(filename);
      item.sizeBytes = sizeBytes;
      item.sha256 = fileSha;

      const [existingRows] = await conn.execute('SELECT id, `key`, url, sizeBytes, sha256, isActive FROM media_assets WHERE tenantId = ? AND (`key` = ? OR url = ?) LIMIT 1', [tenantId, key, url]);
      if (existingRows.length) {
        const existing = existingRows[0];
        item.mediaAssetId = existing.id;
        if (String(existing.sizeBytes) === String(sizeBytes) && existing.sha256 === fileSha && existing.isActive === 1) {
          item.dbStatus = 'existing_record_reused';
          reusedRecord++;
        } else if (!dryRun && !verifyOnly) {
          await conn.execute('UPDATE media_assets SET `key` = ?, url = ?, sourceUrl = ?, sourceSystem = ?, mimeType = ?, sizeBytes = ?, sha256 = ?, originalFilename = ?, altText = COALESCE(altText, ?), isActive = 1, updatedAt = CURRENT_TIMESTAMP WHERE id = ?', [key, url, sourceUrl, 'wordpress-migration', mimeType, sizeBytes, fileSha, filename, filename, existing.id]);
          item.dbStatus = 'existing_record_updated';
          updatedRecord++;
        } else {
          item.dbStatus = dryRun ? 'would_update_existing_record' : 'existing_record_not_updated_verify_only';
          reusedRecord++;
        }
      } else if (!dryRun && !verifyOnly) {
        const [insertResult] = await conn.execute('INSERT INTO media_assets (tenantId, `key`, url, sourceUrl, sourceSystem, mimeType, sizeBytes, sha256, originalFilename, altText, isActive, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [tenantId, key, url, sourceUrl, 'wordpress-migration', mimeType, sizeBytes, fileSha, filename, filename]);
        item.mediaAssetId = insertResult.insertId;
        item.dbStatus = 'record_created';
        createdRecord++;
      } else {
        item.dbStatus = dryRun ? 'would_create_record' : 'record_missing_verify_only';
        if (!dryRun) failed++;
      }

      const verification = await verifyUrl(`${baseUrl}${url}`);
      item.verifyStatus = verification.ok ? 'http_200' : 'http_failed';
      item.httpStatus = verification.status;
      if (verification.ok) verifiedOk++; else verifiedFailed++;
      item.action = 'processed';
    } catch (error) {
      item.action = 'failed';
      item.error = error.message;
      failed++;
    }

    results.push(item);
    if ((index + 1) % 25 === 0 || index + 1 === selectedRows.length) {
      console.log(`[${index + 1}/${selectedRows.length}] imported=${imported} reusedFile=${reusedFile} createdRecord=${createdRecord} updatedRecord=${updatedRecord} reusedRecord=${reusedRecord} failed=${failed} verifiedOk=${verifiedOk} verifiedFailed=${verifiedFailed}`);
    }
  }

  await conn.end();

  const summary = {
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    csvPath,
    publicMediaRoot,
    baseUrl,
    tenantId,
    dryRun,
    verifyOnly,
    approvedRowsInCsv: rows.length,
    processedRows: selectedRows.length,
    importedFiles: imported,
    reusedExistingFiles: reusedFile,
    createdMediaAssetRecords: createdRecord,
    updatedMediaAssetRecords: updatedRecord,
    reusedMediaAssetRecords: reusedRecord,
    failedRows: failed,
    verifiedHttp200: verifiedOk,
    verifiedHttpFailed: verifiedFailed,
  };

  fs.writeFileSync(path.join(reportDir, 'phase1_import_summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(reportDir, 'phase1_import_results.json'), JSON.stringify(results, null, 2));
  const headers = Object.keys(results[0] || { index: '', sourceUrl: '', key: '', url: '', filename: '', destPath: '', action: '', fileStatus: '', dbStatus: '', verifyStatus: '', httpStatus: '', sizeBytes: '', sha256: '', mediaAssetId: '', error: '' });
  fs.writeFileSync(path.join(reportDir, 'phase1_import_results.csv'), headers.join(',') + '\n' + results.map(r => headers.map(h => csvEscape(r[h])).join(',')).join('\n') + '\n');
  console.log(JSON.stringify({ summary, reportDir }, null, 2));
  if (failed > 0 || verifiedFailed > 0) process.exitCode = 2;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
