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
function section(html, start, end) {
  const s = html.indexOf(start);
  if (s < 0) return null;
  const e = end ? html.indexOf(end, s + start.length) : html.length;
  return html.slice(s, e < 0 ? html.length : e);
}
function count(html, re) { return [...String(html || '').matchAll(re)].length; }
async function main() {
  loadEnv('/home/manus/cove-storefront/.env');
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.execute('select id, slug, description, descriptionAr from products where id = ?', [390207]);
  await conn.end();
  const row = rows[0];
  const desc = row.description || '';
  const sections = {
    components: section(desc, 'Roshina Box Components and Specifications:', 'Roshina Box Features:'),
    features: section(desc, 'Roshina Box Features:', 'Box size:'),
    shipment: section(desc, 'Shipment Duration:', null),
  };
  const summary = Object.fromEntries(Object.entries(sections).map(([k,v]) => [k, {
    html: v,
    ulCount: count(v, /<ul\b[^>]*>/gi),
    olCount: count(v, /<ol\b[^>]*>/gi),
    liCount: count(v, /<li\b[^>]*>/gi),
    adjacentLists: count(v, /<\/(?:ul|ol)>\s*<(?:ul|ol)\b[^>]*>/gi),
  }]));
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), id: row.id, slug: row.slug, summary }, null, 2));
}
main().catch(err => { console.error(err); process.exit(1); });
