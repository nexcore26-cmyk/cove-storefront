const fs = require('fs');
const mysql = require('mysql2/promise');

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

function aroundHeading(html, heading) {
  const idx = html.toLowerCase().indexOf(heading.toLowerCase());
  if (idx === -1) return { found: false };
  const start = Math.max(0, idx - 600);
  const end = Math.min(html.length, idx + 2200);
  const snippet = html.slice(start, end);
  const after = html.slice(idx, Math.min(html.length, idx + 5000));
  const firstUl = after.match(/<ul[\s\S]*?<\/ul>/i);
  const firstOl = after.match(/<ol[\s\S]*?<\/ol>/i);
  const firstList = firstUl && firstOl ? (firstUl.index < firstOl.index ? firstUl[0] : firstOl[0]) : (firstUl ? firstUl[0] : (firstOl ? firstOl[0] : null));
  return {
    found: true,
    index: idx,
    snippet,
    firstList,
    listTag: firstList ? (firstList.match(/^<(ul|ol)/i) || [])[1] : null,
    listOpenTag: firstList ? (firstList.match(/^<[^>]+>/) || [])[0] : null,
    liOpenTags: firstList ? [...firstList.matchAll(/<li\b[^>]*>/gi)].map(m => m[0]).slice(0, 10) : [],
  };
}

async function main() {
  loadEnv('/home/manus/cove-storefront/.env');
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const conn = await mysql.createConnection(url);
  const [rows] = await conn.execute('select id, slug, description, descriptionAr, shortDescription, shortDescriptionAr from products where id = ?', [390207]);
  await conn.end();
  if (!rows.length) throw new Error('Product 390207 not found');
  const row = rows[0];
  const html = row.description || '';
  const headings = ['Roshina Box Components and Specifications:', 'Roshina Box Features:', 'Shipment Duration:'];
  const result = {
    id: row.id,
    slug: row.slug,
    descriptionLength: html.length,
    sections: Object.fromEntries(headings.map(h => [h, aroundHeading(html, h)])),
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
