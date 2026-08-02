const fs = require('fs');
const mysql = require('mysql2/promise');

function loadEnvValue(filePath, key) {
  const content = fs.readFileSync(filePath, 'utf8');
  const line = content.split(/\r?\n/).find((entry) => entry.startsWith(`${key}=`));
  if (!line) throw new Error(`${key} not found`);
  return line.slice(key.length + 1).trim();
}

(async () => {
  const databaseUrl = loadEnvValue('/home/manus/cove-storefront/.env', 'DATABASE_URL');
  const conn = await mysql.createConnection(databaseUrl);
  try {
    const [tables] = await conn.query("SHOW TABLES LIKE '%variant%'");
    console.log(JSON.stringify({ tables }, null, 2));

    const [columns] = await conn.query('SHOW COLUMNS FROM product_variants');
    console.log(JSON.stringify({ product_variants_columns: columns.map((c) => c.Field) }, null, 2));

    const [rows] = await conn.query(`
      SELECT pv.id, pv.productId, p.slug, p.name, pv.htmlBlockEnabled,
             LEFT(pv.htmlBlockContent, 500) AS htmlBlockContent
      FROM product_variants pv
      JOIN products p ON p.id = pv.productId
      WHERE pv.htmlBlockContent IS NOT NULL
        AND TRIM(pv.htmlBlockContent) <> ''
        AND (pv.htmlBlockContent LIKE '%<ul%' OR pv.htmlBlockContent LIKE '%<ol%' OR pv.htmlBlockContent LIKE '%<li%')
      LIMIT 10
    `);
    console.log(JSON.stringify({ list_rows: rows }, null, 2));
  } finally {
    await conn.end();
  }
})().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
