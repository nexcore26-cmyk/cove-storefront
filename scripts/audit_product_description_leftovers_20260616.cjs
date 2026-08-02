#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  const raw = fs.readFileSync(filePath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function getDbUrl() {
  const cwd = process.cwd();
  const env = { ...loadEnvFile(path.join(cwd, '.env')), ...process.env };
  return env.DATABASE_URL || env.MYSQL_URL || env.TIDB_DATABASE_URL;
}

const descriptionFields = ['description', 'descriptionAr', 'shortDescription', 'shortDescriptionAr'];
const patterns = [
  { key: 'wpbakery_shortcode', regex: /\[\/?vc_[^\]]*\]/i },
  { key: 'woodmart_shortcode_attr', regex: /woodmart_[a-z0-9_-]+\s*=\s*["'][^"']*["']/i },
  { key: 'style_list_none_wrapper', regex: /<li\b[^>]*list-style-type\s*:\s*none[^>]*>\s*<(ol|ul)\b/i },
  { key: 'any_raw_shortcode', regex: /\[[a-zA-Z_][a-zA-Z0-9_-]*(?:\s[^\]]*)?\]|\[\/[a-zA-Z_][a-zA-Z0-9_-]*\]/i },
];

function snippet(value, regex) {
  const text = String(value || '');
  const m = text.match(regex);
  if (!m || m.index == null) return '';
  const start = Math.max(0, m.index - 80);
  const end = Math.min(text.length, m.index + m[0].length + 120);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

(async () => {
  const dbUrl = getDbUrl();
  if (!dbUrl) {
    throw new Error('DATABASE_URL/MYSQL_URL/TIDB_DATABASE_URL was not found in environment or .env');
  }

  const connection = await mysql.createConnection(dbUrl);
  try {
    const [rows] = await connection.execute(
      'SELECT id, slug, name, nameAr, description, descriptionAr, shortDescription, shortDescriptionAr FROM products ORDER BY id ASC'
    );

    const summary = {
      auditedAt: new Date().toISOString(),
      table: 'products',
      totalProducts: rows.length,
      fieldsAudited: descriptionFields,
      affectedProducts: 0,
      affectedCells: 0,
      byField: Object.fromEntries(descriptionFields.map((f) => [f, { affectedCells: 0, totalBytes: 0 }])),
      byPattern: Object.fromEntries(patterns.map((p) => [p.key, 0])),
      samples: [],
    };

    for (const row of rows) {
      let productAffected = false;
      for (const field of descriptionFields) {
        const value = row[field];
        if (value == null || value === '') continue;
        const text = String(value);
        summary.byField[field].totalBytes += Buffer.byteLength(text, 'utf8');
        const matchedPatterns = patterns.filter((p) => p.regex.test(text));
        if (!matchedPatterns.length) continue;
        productAffected = true;
        summary.affectedCells += 1;
        summary.byField[field].affectedCells += 1;
        for (const p of matchedPatterns) summary.byPattern[p.key] += 1;
        if (summary.samples.length < 40) {
          summary.samples.push({
            id: row.id,
            slug: row.slug,
            name: row.name,
            field,
            matchedPatterns: matchedPatterns.map((p) => p.key),
            snippet: snippet(text, matchedPatterns[0].regex),
            bytes: Buffer.byteLength(text, 'utf8'),
          });
        }
      }
      if (productAffected) summary.affectedProducts += 1;
    }

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await connection.end();
  }
})().catch((err) => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
  process.exit(1);
});
