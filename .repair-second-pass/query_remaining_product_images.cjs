const mysql = require('mysql2/promise');
const fs = require('fs');

function loadEnv(path) {
  const out = {};
  const text = fs.readFileSync(path, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[m[1]] = value;
  }
  return out;
}

(async () => {
  const env = loadEnv('/home/manus/cove-storefront/.env');
  const conn = await mysql.createConnection(env.DATABASE_URL);
  const slugs = [
    'mini-roshina-beige','mini-roshina-gray','tissue-box-beige','tissue-box-black','tissue-box-bronze',
    'beige-trash-bin','black-trash-bin','bronze-trash-bin'
  ];
  const [cols] = await conn.query('SHOW COLUMNS FROM products');
  const names = cols.map(c => c.Field);
  const wanted = ['id','name','title','nameEn','name_en','slug', ...names.filter(n => /image|gallery|media|photo|thumbnail/i.test(n))];
  const selectCols = [...new Set(wanted.filter(n => names.includes(n)))];
  console.error(JSON.stringify({imageColumns:names.filter(n => /image|gallery|media|photo|thumbnail/i.test(n)), selectCols}, null, 2));
  const sql = `SELECT ${selectCols.map(c => '`'+c+'`').join(', ')} FROM products WHERE slug IN (?)`;
  const [rows] = await conn.query(sql, [slugs]);
  console.log(JSON.stringify(rows, null, 2));
  await conn.end();
})().catch(err => { console.error(err); process.exit(1); });
