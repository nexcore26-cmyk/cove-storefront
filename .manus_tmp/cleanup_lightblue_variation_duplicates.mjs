import mysql from 'mysql2/promise';
import fs from 'fs';

function loadEnv(file) {
  const txt = fs.readFileSync(file, 'utf8');
  for (const line of txt.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
}

function normalize(value) {
  return String(value ?? '').trim().toLowerCase();
}

function parseAttributes(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function normalizePayload(attributesPayload) {
  const parsed = parseAttributes(attributesPayload);
  if (Array.isArray(parsed)) {
    const normalized = {};
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const key = entry.name ?? entry.attribute ?? entry.label ?? entry.slug;
      const value = entry.option ?? entry.value ?? entry.labelEn ?? entry.label;
      if (key && value) normalized[String(key)] = String(value);
    }
    return normalized;
  }
  if (parsed && typeof parsed === 'object') {
    const normalized = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!key || value === null || value === undefined || typeof value === 'object') continue;
      normalized[key] = String(value);
    }
    return normalized;
  }
  return {};
}

function signature(attributesPayload) {
  return Object.entries(normalizePayload(attributesPayload))
    .map(([key, value]) => `${normalize(key)}=${normalize(value)}`)
    .sort()
    .join('|');
}

const dryRun = process.argv.includes('--dry-run');
loadEnv('.env');
const conn = await mysql.createConnection(process.env.DATABASE_URL);

const slug = 'roshina-3-light-blue';
const [products] = await conn.query('SELECT id, name, slug FROM products WHERE slug = ? LIMIT 1', [slug]);
const product = products[0];
if (!product) throw new Error(`Product not found: ${slug}`);

const [rows] = await conn.query(
  'SELECT id, sku, name, attributes, manageStock, createdAt, updatedAt FROM product_variants WHERE productId = ? ORDER BY id',
  [product.id]
);

const intendedSignatures = new Set(['select box set=basic set', 'select box set=full set']);
const groups = new Map();
const blankIds = [];
for (const row of rows) {
  const sig = signature(row.attributes);
  if (!sig) {
    blankIds.push(row.id);
    continue;
  }
  if (!groups.has(sig)) groups.set(sig, []);
  groups.get(sig).push(row);
}

const keepIds = [];
const deleteIds = [...blankIds];
const summary = [];

for (const sig of intendedSignatures) {
  const group = (groups.get(sig) || []).sort((a, b) => Number(a.id) - Number(b.id));
  if (group.length === 0) {
    summary.push({ signature: sig, kept: null, deleted: [] });
    continue;
  }
  const [keep, ...dupes] = group;
  keepIds.push(keep.id);
  deleteIds.push(...dupes.map((row) => row.id));
  summary.push({ signature: sig, kept: keep.id, deleted: dupes.map((row) => row.id) });
}

const unexpectedNonBlank = [];
for (const [sig, group] of groups.entries()) {
  if (!intendedSignatures.has(sig)) unexpectedNonBlank.push({ signature: sig, ids: group.map((row) => row.id) });
}

const output = {
  product,
  dryRun,
  beforeCount: rows.length,
  keepIds,
  blankIds,
  deleteIds: [...new Set(deleteIds)].sort((a, b) => Number(a) - Number(b)),
  summary,
  unexpectedNonBlank,
};

if (!dryRun && output.deleteIds.length > 0) {
  const placeholders = output.deleteIds.map(() => '?').join(',');
  await conn.query(`DELETE FROM product_variants WHERE productId = ? AND id IN (${placeholders})`, [product.id, ...output.deleteIds]);
  const [after] = await conn.query('SELECT id, sku, name, attributes FROM product_variants WHERE productId = ? ORDER BY id', [product.id]);
  output.afterCount = after.length;
  output.afterRows = after;
}

console.log(JSON.stringify(output, null, 2));
await conn.end();
