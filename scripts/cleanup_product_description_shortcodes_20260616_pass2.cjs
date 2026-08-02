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

const fieldsToClean = ['description', 'descriptionAr'];
const fieldsToAudit = ['description', 'descriptionAr', 'shortDescription', 'shortDescriptionAr'];
const leftoverPatterns = [
  { key: 'wpbakery_shortcode', regex: /\[\/?vc_[^\]]*\]/i },
  { key: 'woodmart_shortcode_attr', regex: /woodmart_[a-z0-9_-]+\s*=\s*["'][^"']*["']/i },
  { key: 'style_list_none_wrapper', regex: /<li\b[^>]*list-style-type\s*:\s*none[^>]*>\s*<(ol|ul)\b/i },
  { key: 'any_raw_shortcode', regex: /\[[a-zA-Z_][a-zA-Z0-9_-]*(?:\s[^\]]*)?\]|\[\/[a-zA-Z_][a-zA-Z0-9_-]*\]/i },
];

function cleanLegacyDescriptionHtml(input) {
  if (input == null || input === '') return input;
  let html = String(input);

  // Remove old WPBakery Visual Composer and Woodmart shortcodes, including wrappers
  // such as vc_row/vc_column/vc_column_text and standalone elements such as vc_empty_space.
  html = html
    .replace(/\[\/?vc_[^\]]*\]/gi, '')
    .replace(/\[\/?woodmart_[^\]]*\]/gi, '');

  // Repeatedly unwrap imported list shells like:
  // <ol><li style="list-style-type: none;"><ol>real list...</ol></li></ol>
  // and the same pattern for <ul>.
  let previous;
  do {
    previous = html;
    html = html.replace(
      /<(ol|ul)\b[^>]*>\s*<li\b[^>]*style\s*=\s*(["'])[^"']*list-style-type\s*:\s*none;?[^"']*\2[^>]*>\s*<(ol|ul)\b([^>]*)>([\s\S]*?)<\/\3>\s*<\/li>\s*<\/\1>/gi,
      '<$3$4>$5</$3>'
    );
  } while (html !== previous);

  // Remove any remaining standalone no-marker empty list item wrappers while preserving nested content.
  html = html.replace(/<li\b[^>]*style\s*=\s*(["'])[^"']*list-style-type\s*:\s*none;?[^"']*\1[^>]*>\s*<\/(li)>/gi, '');

  // Light whitespace cleanup around removed shortcode boundaries only; do not alter real HTML text content.
  html = html.replace(/^\s+|\s+$/g, '');
  html = html.replace(/\n{3,}/g, '\n\n');
  return html;
}

function findMatches(row) {
  const matches = [];
  for (const field of fieldsToAudit) {
    const value = row[field];
    if (value == null || value === '') continue;
    const text = String(value);
    const matchedPatterns = leftoverPatterns.filter((p) => p.regex.test(text)).map((p) => p.key);
    if (matchedPatterns.length) matches.push({ field, matchedPatterns });
  }
  return matches;
}

(async () => {
  const dbUrl = getDbUrl();
  if (!dbUrl) throw new Error('DATABASE_URL/MYSQL_URL/TIDB_DATABASE_URL was not found in environment or .env');

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const backupDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `product_description_shortcode_cleanup_backup_${timestamp}.json`);

  const connection = await mysql.createConnection(dbUrl);
  try {
    const [rows] = await connection.execute(
      'SELECT id, slug, name, nameAr, description, descriptionAr, shortDescription, shortDescriptionAr FROM products ORDER BY id ASC'
    );

    const affectedRows = [];
    const updates = [];

    for (const row of rows) {
      const beforeMatches = findMatches(row);
      if (!beforeMatches.length) continue;

      const nextDescription = cleanLegacyDescriptionHtml(row.description);
      const nextDescriptionAr = cleanLegacyDescriptionHtml(row.descriptionAr);
      const changed = nextDescription !== row.description || nextDescriptionAr !== row.descriptionAr;

      affectedRows.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        nameAr: row.nameAr,
        beforeMatches,
        description: row.description,
        descriptionAr: row.descriptionAr,
        shortDescription: row.shortDescription,
        shortDescriptionAr: row.shortDescriptionAr,
      });

      if (changed) {
        updates.push({
          id: row.id,
          slug: row.slug,
          description: nextDescription,
          descriptionAr: nextDescriptionAr,
        });
      }
    }

    fs.writeFileSync(backupPath, JSON.stringify({
      backedUpAt: new Date().toISOString(),
      table: 'products',
      affectedRows: affectedRows.length,
      updateRows: updates.length,
      fieldsUpdated: fieldsToClean,
      rows: affectedRows,
    }, null, 2));

    await connection.beginTransaction();
    try {
      for (const update of updates) {
        await connection.execute(
          'UPDATE products SET description = ?, descriptionAr = ? WHERE id = ?',
          [update.description, update.descriptionAr, update.id]
        );
      }
      await connection.commit();
    } catch (err) {
      await connection.rollback();
      throw err;
    }

    const [afterRows] = await connection.execute(
      'SELECT id, slug, name, nameAr, description, descriptionAr, shortDescription, shortDescriptionAr FROM products ORDER BY id ASC'
    );

    const afterAffected = afterRows.filter((row) => findMatches(row).length > 0);
    const byField = Object.fromEntries(fieldsToAudit.map((f) => [f, 0]));
    for (const row of afterRows) {
      for (const m of findMatches(row)) byField[m.field] += 1;
    }

    console.log(JSON.stringify({
      cleanedAt: new Date().toISOString(),
      backupPath,
      totalProducts: rows.length,
      backedUpRows: affectedRows.length,
      updatedRows: updates.length,
      remainingAffectedProducts: afterAffected.length,
      remainingAffectedCellsByField: byField,
      sampleRemaining: afterAffected.slice(0, 10).map((row) => ({ id: row.id, slug: row.slug, matches: findMatches(row) })),
    }, null, 2));
  } finally {
    await connection.end();
  }
})().catch((err) => {
  console.error(JSON.stringify({ error: err.message, stack: err.stack }, null, 2));
  process.exit(1);
});
