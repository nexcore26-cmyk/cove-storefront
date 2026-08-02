const fs = require('fs');
const mysql = require('mysql2/promise');

const FIELDS = ['shortDescription', 'shortDescriptionAr', 'description', 'descriptionAr'];

function loadEnv(path) {
  const env = fs.readFileSync(path, 'utf8');
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

function analyzeField(html) {
  html = String(html || '');
  const ulCount = countMatches(html, /<ul\b[^>]*>/gi);
  const olCount = countMatches(html, /<ol\b[^>]*>/gi);
  const liCount = countMatches(html, /<li\b[^>]*>/gi);
  const adjacentUlCount = countMatches(html, /<\/ul>\s*<ul\b[^>]*>/gi);
  const adjacentOlCount = countMatches(html, /<\/ol>\s*<ol\b[^>]*>/gi);
  const mixedAdjacentListCount = countMatches(html, /<\/(?:ul|ol)>\s*<(?:ul|ol)\b[^>]*>/gi);
  const numericStyleCount = countMatches(html, /list-style(?:-type)?\s*:\s*(?:decimal|lower-alpha|upper-alpha|lower-roman|upper-roman)/gi);
  const noneStyleCount = countMatches(html, /list-style(?:-type)?\s*:\s*none/gi);
  const hasIssue = olCount > 0 || adjacentUlCount > 0 || adjacentOlCount > 0 || numericStyleCount > 0;
  return { ulCount, olCount, liCount, adjacentUlCount, adjacentOlCount, mixedAdjacentListCount, numericStyleCount, noneStyleCount, hasIssue };
}

function snippetAround(html, regex) {
  html = String(html || '');
  const match = regex.exec(html);
  if (!match) return null;
  const start = Math.max(0, match.index - 220);
  const end = Math.min(html.length, match.index + match[0].length + 480);
  return html.slice(start, end);
}

async function main() {
  loadEnv('/home/manus/cove-storefront/.env');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const conn = await mysql.createConnection(url);
  const [rows] = await conn.execute(`select id, slug, ${FIELDS.join(', ')} from products order by id`);
  await conn.end();

  const totals = { products: rows.length, affectedProducts: 0, affectedCells: 0, ulCount: 0, olCount: 0, liCount: 0, adjacentUlCount: 0, adjacentOlCount: 0, mixedAdjacentListCount: 0, numericStyleCount: 0, noneStyleCount: 0 };
  const byField = Object.fromEntries(FIELDS.map(f => [f, { affectedCells: 0, ulCount: 0, olCount: 0, liCount: 0, adjacentUlCount: 0, adjacentOlCount: 0, mixedAdjacentListCount: 0, numericStyleCount: 0, noneStyleCount: 0 }]));
  const affected = [];

  for (const row of rows) {
    const productMatches = [];
    for (const field of FIELDS) {
      const stats = analyzeField(row[field]);
      for (const key of ['ulCount','olCount','liCount','adjacentUlCount','adjacentOlCount','mixedAdjacentListCount','numericStyleCount','noneStyleCount']) {
        totals[key] += stats[key];
        byField[field][key] += stats[key];
      }
      if (stats.hasIssue) {
        totals.affectedCells += 1;
        byField[field].affectedCells += 1;
        productMatches.push({
          field,
          ...stats,
          orderedListSnippet: snippetAround(row[field], /<ol\b[^>]*>[\s\S]*?<\/ol>/i),
          adjacentListSnippet: snippetAround(row[field], /<\/(?:ul|ol)>\s*<(?:ul|ol)\b[^>]*>/i),
          numericStyleSnippet: snippetAround(row[field], /list-style(?:-type)?\s*:\s*(?:decimal|lower-alpha|upper-alpha|lower-roman|upper-roman)/i),
        });
      }
    }
    if (productMatches.length) {
      totals.affectedProducts += 1;
      affected.push({ id: row.id, slug: row.slug, matches: productMatches });
    }
  }

  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), fields: FIELDS, totals, byField, affectedProducts: affected, samples: affected.slice(0, 25) }, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
