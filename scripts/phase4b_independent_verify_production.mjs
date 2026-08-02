import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(new URL('/home/manus/cove-storefront/package.json', import.meta.url));
const mysql = require('mysql2/promise');

const appRoot = '/home/manus/cove-storefront';
const approvalCsv = path.join(appRoot, 'scripts', 'phase4b_approval_ready_candidates.csv');

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
  const header = rows.shift() || [];
  return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));
}

function filePathForUrl(url) {
  return path.join(appRoot, 'public', url.replace(/^\//, ''));
}

loadEnv();
const rows = parseCsv(fs.readFileSync(approvalCsv, 'utf8'));
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const remaining = [];
let dbRemaining = 0;
let fsRemaining = 0;
for (const row of rows) {
  const [dbRows] = await conn.execute('SELECT id, url FROM media_assets WHERE url = ? OR id = ? LIMIT 20', [row.url, row.mediaAssetId || 0]);
  const fileExists = fs.existsSync(filePathForUrl(row.url));
  if (dbRows.length) dbRemaining += dbRows.length;
  if (fileExists) fsRemaining += 1;
  if (dbRows.length || fileExists) remaining.push({ candidateId: row.candidateId, kind: row.kind, mediaAssetId: row.mediaAssetId, url: row.url, dbRows, fileExists });
}
await conn.end();
console.log(JSON.stringify({ approvedRows: rows.length, dbRemaining, fsRemaining, remaining }, null, 2));
