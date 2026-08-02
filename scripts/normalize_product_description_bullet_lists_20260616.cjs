const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const FIELDS = ['shortDescription', 'shortDescriptionAr', 'description', 'descriptionAr'];
const APPLY = process.argv.includes('--apply');

function loadEnv(envPath) {
  const env = fs.readFileSync(envPath, 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

function countMatches(html, regex) {
  return [...String(html || '').matchAll(regex)].length;
}

function stripNumericListStyles(attrs) {
  if (!attrs) return '';
  // Remove list-style numeric declarations if they exist on imported list tags.
  return attrs.replace(/style=("|')([^"']*)\1/gi, (full, quote, style) => {
    const cleaned = style
      .split(';')
      .map(s => s.trim())
      .filter(Boolean)
      .filter(s => !/^list-style(?:-type)?\s*:\s*(decimal|lower-alpha|upper-alpha|lower-roman|upper-roman)\b/i.test(s))
      .join('; ');
    return cleaned ? `style=${quote}${cleaned}${quote}` : '';
  }).replace(/\s+/g, ' ').trimStart();
}

function normalizeHtml(input) {
  if (input == null || input === '') return { value: input, changed: false, stats: emptyStats() };
  let html = String(input);
  const before = html;
  const stats = emptyStats();

  stats.orderedListsBefore = countMatches(html, /<ol\b[^>]*>/gi);
  stats.adjacentListsBefore = countMatches(html, /<\/(?:ul|ol)>\s*<(?:ul|ol)\b[^>]*>/gi);
  stats.numericStyleBefore = countMatches(html, /list-style(?:-type)?\s*:\s*(?:decimal|lower-alpha|upper-alpha|lower-roman|upper-roman)/gi);

  // Convert every ordered list wrapper into an unordered list wrapper. This intentionally
  // changes all description lists to bullets while preserving all <li> content.
  html = html.replace(/<ol\b([^>]*)>/gi, (_m, attrs) => `<ul${stripNumericListStyles(attrs)}>`);
  html = html.replace(/<\/ol>/gi, '</ul>');

  // Remove numeric list-style declarations if imported HTML placed them on <ul> or <li>.
  html = html.replace(/(<(?:ul|li)\b[^>]*style=("|')([^"']*)(\2)[^>]*>)/gi, (tag) => {
    return tag.replace(/style=("|')([^"']*)\1/gi, (full, quote, style) => {
      const cleaned = style
        .split(';')
        .map(s => s.trim())
        .filter(Boolean)
        .filter(s => !/^list-style(?:-type)?\s*:\s*(decimal|lower-alpha|upper-alpha|lower-roman|upper-roman)\b/i.test(s))
        .join('; ');
      return cleaned ? `style=${quote}${cleaned}${quote}` : '';
    }).replace(/\s+>/g, '>');
  });

  // Merge immediately adjacent bullet lists so content like
  // <ul><li>A</li></ul><ul><li>B</li></ul> becomes <ul><li>A</li><li>B</li></ul>.
  // Only whitespace is allowed between the two lists, so headings, paragraphs, and <br>
  // separators remain untouched.
  let previous;
  do {
    previous = html;
    html = html.replace(/<ul\b([^>]*)>([\s\S]*?)<\/ul>\s*<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, '<ul$1>$2$3</ul>');
  } while (html !== previous);

  stats.orderedListsAfter = countMatches(html, /<ol\b[^>]*>/gi);
  stats.adjacentListsAfter = countMatches(html, /<\/(?:ul|ol)>\s*<(?:ul|ol)\b[^>]*>/gi);
  stats.numericStyleAfter = countMatches(html, /list-style(?:-type)?\s*:\s*(?:decimal|lower-alpha|upper-alpha|lower-roman|upper-roman)/gi);
  stats.convertedOrderedLists = stats.orderedListsBefore - stats.orderedListsAfter;
  stats.mergedAdjacentLists = stats.adjacentListsBefore - stats.adjacentListsAfter;
  stats.removedNumericStyleOccurrences = stats.numericStyleBefore - stats.numericStyleAfter;

  return { value: html, changed: html !== before, stats };
}

function emptyStats() {
  return {
    orderedListsBefore: 0,
    orderedListsAfter: 0,
    convertedOrderedLists: 0,
    adjacentListsBefore: 0,
    adjacentListsAfter: 0,
    mergedAdjacentLists: 0,
    numericStyleBefore: 0,
    numericStyleAfter: 0,
    removedNumericStyleOccurrences: 0,
  };
}

function addStats(target, source) {
  for (const key of Object.keys(emptyStats())) target[key] += source[key] || 0;
}

function previewChange(before, after) {
  const b = String(before || '');
  const a = String(after || '');
  let i = 0;
  while (i < b.length && i < a.length && b[i] === a[i]) i++;
  const start = Math.max(0, i - 220);
  return { before: b.slice(start, Math.min(b.length, i + 520)), after: a.slice(start, Math.min(a.length, i + 520)) };
}

async function main() {
  loadEnv('/home/manus/cove-storefront/.env');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const conn = await mysql.createConnection(url);
  const [rows] = await conn.execute(`select id, slug, ${FIELDS.join(', ')} from products order by id`);

  const totals = { products: rows.length, affectedProducts: 0, affectedCells: 0, ...emptyStats() };
  const byField = Object.fromEntries(FIELDS.map(f => [f, { affectedCells: 0, ...emptyStats() }]));
  const changes = [];

  for (const row of rows) {
    const normalized = {};
    const productChanges = [];
    for (const field of FIELDS) {
      const result = normalizeHtml(row[field]);
      if (result.changed) {
        normalized[field] = result.value;
        totals.affectedCells += 1;
        byField[field].affectedCells += 1;
        addStats(totals, result.stats);
        addStats(byField[field], result.stats);
        productChanges.push({ field, stats: result.stats, preview: previewChange(row[field], result.value) });
      }
    }
    if (productChanges.length) {
      totals.affectedProducts += 1;
      changes.push({ id: row.id, slug: row.slug, changes: productChanges, normalized });
    }
  }

  let backupPath = null;
  let updatedRows = 0;
  if (APPLY && changes.length) {
    const backupRows = rows.filter(row => changes.some(c => c.id === row.id));
    const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const backupDir = '/home/manus/cove-storefront/backups';
    fs.mkdirSync(backupDir, { recursive: true });
    backupPath = path.join(backupDir, `product_description_bullet_list_normalization_backup_${ts}.json`);
    fs.writeFileSync(backupPath, JSON.stringify({ generatedAt: new Date().toISOString(), fields: FIELDS, affectedRows: backupRows }, null, 2));

    for (const change of changes) {
      const setFields = Object.keys(change.normalized);
      if (!setFields.length) continue;
      const sql = `update products set ${setFields.map(f => `${f} = ?`).join(', ')} where id = ?`;
      const params = setFields.map(f => change.normalized[f]);
      params.push(change.id);
      const [res] = await conn.execute(sql, params);
      updatedRows += res.affectedRows || 0;
    }
  }

  await conn.end();

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    mode: APPLY ? 'apply' : 'dry-run',
    fields: FIELDS,
    totals,
    byField,
    backupPath,
    updatedRows,
    sampleChanges: changes.slice(0, 20).map(({ normalized, ...rest }) => rest),
  }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
