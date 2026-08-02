import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(new URL('/home/manus/cove-storefront/package.json', import.meta.url));
const mysql = require('mysql2/promise');

const appRoot = '/home/manus/cove-storefront';
const outDir = path.join(appRoot, 'reports', `post-cleanup-qa-${new Date().toISOString().replace(/[:.]/g, '-')}`);

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

function extractMediaUrls(value) {
  const s = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  const out = new Set();
  for (const m of s.matchAll(/(?:https?:\/\/app\.coveinterior\.com)?\/media\/[A-Za-z0-9_.,%()\-+&=@~!#$;'\[\]{}\/]+/g)) {
    out.add(String(m[0]).replace(/^https?:\/\/app\.coveinterior\.com/, '').replace(/["'\])},.]+$/, ''));
  }
  return [...out].filter(u => u.startsWith('/media/'));
}

function routeCandidates(row, type) {
  const slug = row.slug || row.handle || row.urlKey || row.path || '';
  const id = row.id || '';
  if (type === 'product') return [...new Set([slug && `/products/${slug}`, slug && `/product/${slug}`, id && `/products/${id}`].filter(Boolean))];
  if (type === 'category') return [...new Set([slug && `/categories/${slug}`, slug && `/category/${slug}`, id && `/categories/${id}`].filter(Boolean))];
  if (type === 'page') {
    const pageSlug = slug || row.route || row.url || '';
    if (!pageSlug) return [];
    if (pageSlug === '/' || pageSlug === 'home') return ['/'];
    return [pageSlug.startsWith('/') ? pageSlug : `/${pageSlug}`];
  }
  return [];
}

async function getColumns(conn, table) {
  const [rows] = await conn.execute(`SHOW COLUMNS FROM \`${table}\``);
  return rows.map(r => r.Field);
}

async function tableExists(conn, table) {
  const [rows] = await conn.execute('SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?', [table]);
  return rows[0].c > 0;
}

async function fetchSample(conn, table, preferredCols, orderColCandidates = []) {
  if (!(await tableExists(conn, table))) return { table, exists: false, columns: [], rows: [] };
  const cols = await getColumns(conn, table);
  const selected = preferredCols.filter(c => cols.includes(c));
  if (!selected.includes('id') && cols.includes('id')) selected.unshift('id');
  const orderCol = orderColCandidates.find(c => cols.includes(c)) || (cols.includes('updatedAt') ? 'updatedAt' : cols.includes('createdAt') ? 'createdAt' : cols.includes('id') ? 'id' : null);
  const orderSql = orderCol ? ` ORDER BY \`${orderCol}\` DESC` : '';
  const [rows] = await conn.execute(`SELECT ${selected.map(c => `\`${c}\``).join(', ')} FROM \`${table}\`${orderSql} LIMIT 25`);
  return { table, exists: true, columns: cols, selectedColumns: selected, rows };
}

loadEnv();
fs.mkdirSync(outDir, { recursive: true });
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [dbRows] = await conn.execute('SELECT DATABASE() AS dbName');
const [tableCounts] = await conn.execute(`
  SELECT TABLE_NAME AS tableName, TABLE_ROWS AS estimatedRows
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE()
  ORDER BY TABLE_NAME
`);

const products = await fetchSample(conn, 'products', ['id','name','title','slug','handle','sku','status','images','createdAt','updatedAt'], ['updatedAt','createdAt','id']);
const categories = await fetchSample(conn, 'categories', ['id','name','title','slug','handle','image','createdAt','updatedAt'], ['updatedAt','createdAt','id']);
const pages = await fetchSample(conn, 'pages', ['id','title','name','slug','route','url','status','puckData','createdAt','updatedAt'], ['updatedAt','createdAt','id']);
const pageBlocks = await fetchSample(conn, 'page_blocks', ['id','pageId','type','config','createdAt','updatedAt'], ['updatedAt','createdAt','id']);
const homeSections = await fetchSample(conn, 'homepage_sections', ['id','title','name','type','imageUrl','createdAt','updatedAt'], ['updatedAt','createdAt','id']);
const orders = await fetchSample(conn, 'orders', ['id','orderNumber','status','createdAt','updatedAt','total'], ['updatedAt','createdAt','id']);
const orderItems = await fetchSample(conn, 'order_items', ['id','orderId','productId','name','image','createdAt','updatedAt'], ['updatedAt','createdAt','id']);
await conn.end();

const sampleRoutes = [];
for (const r of products.rows.slice(0, 10)) sampleRoutes.push(...routeCandidates(r, 'product').map(url => ({ type: 'product', id: r.id, name: r.name || r.title || r.sku || '', url })));
for (const r of categories.rows.slice(0, 8)) sampleRoutes.push(...routeCandidates(r, 'category').map(url => ({ type: 'category', id: r.id, name: r.name || r.title || '', url })));
for (const r of pages.rows.slice(0, 12)) sampleRoutes.push(...routeCandidates(r, 'page').map(url => ({ type: 'page', id: r.id, name: r.title || r.name || '', url })));
sampleRoutes.unshift({ type: 'core', id: '', name: 'Home', url: '/' }, { type: 'core', id: '', name: 'Shop', url: '/shop' }, { type: 'core', id: '', name: 'Cart', url: '/cart' });

const mediaUrls = new Set();
for (const source of [products, categories, pages, pageBlocks, homeSections, orderItems]) {
  for (const row of source.rows || []) {
    for (const val of Object.values(row)) for (const u of extractMediaUrls(val)) mediaUrls.add(u);
  }
}

const output = {
  collectedAt: new Date().toISOString(),
  database: dbRows[0].dbName,
  tableCounts,
  samples: { products, categories, pages, pageBlocks, homeSections, orders, orderItems },
  sampleRoutes: sampleRoutes.filter((v, i, a) => a.findIndex(x => x.url === v.url) === i).slice(0, 50),
  sampledMediaUrls: [...mediaUrls].slice(0, 200),
  reportDir: outDir
};
fs.writeFileSync(path.join(outDir, 'post_cleanup_qa_context.json'), JSON.stringify(output, null, 2));
console.log(JSON.stringify({ reportDir: outDir, database: output.database, sampleRoutes: output.sampleRoutes.length, sampledMediaUrls: output.sampledMediaUrls.length, tables: tableCounts.length }, null, 2));
