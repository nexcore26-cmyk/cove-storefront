const mysql = require('mysql2/promise');
require('dotenv').config();
const stamp = process.argv[2];
(async () => {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const backupPrefix = `mini_roshina_cleanup_${stamp}`;
  const targetSlugs = ['mini-roshina-black','mini-roshina-beige','mini-roshina-gray'];
  const [products] = await conn.query(`SELECT id, name, slug FROM products WHERE slug IN (?,?,?) ORDER BY slug`, targetSlugs);
  const productIds = products.map(p => p.id);
  const [attrs] = productIds.length ? await conn.query(`SELECT id, attributeId FROM product_attributes WHERE productId IN (${productIds.map(()=>'?').join(',')})`, productIds) : [[]];
  const attrIds = [...new Set(attrs.map(a => a.attributeId))];
  const paIds = attrs.map(a => a.id);
  const tables = [];
  async function backupTable(name, whereSql, params) {
    const backupName = `${name}_backup_${backupPrefix}`;
    await conn.query(`DROP TABLE IF EXISTS ${backupName}`);
    await conn.query(`CREATE TABLE ${backupName} AS SELECT * FROM ${name} WHERE ${whereSql}`, params);
    const [countRows] = await conn.query(`SELECT COUNT(*) AS count FROM ${backupName}`);
    tables.push({ table: name, backupTable: backupName, rows: countRows[0].count });
  }
  if (productIds.length) {
    await backupTable('products', `id IN (${productIds.map(()=>'?').join(',')})`, productIds);
    await backupTable('product_attributes', `productId IN (${productIds.map(()=>'?').join(',')})`, productIds);
  }
  if (attrIds.length) {
    await backupTable('attributes', `id IN (${attrIds.map(()=>'?').join(',')})`, attrIds);
    await backupTable('attribute_values', `attributeId IN (${attrIds.map(()=>'?').join(',')})`, attrIds);
  }
  if (paIds.length) {
    const [stockCols] = await conn.query('SHOW COLUMNS FROM attribute_value_stock');
    const fields = stockCols.map(c => c.Field);
    if (fields.includes('productAttributeId')) {
      await backupTable('attribute_value_stock', `productAttributeId IN (${paIds.map(()=>'?').join(',')})`, paIds);
    } else {
      const [avRows] = await conn.query(`SELECT id FROM attribute_values WHERE attributeId IN (${attrIds.map(()=>'?').join(',')})`, attrIds);
      const avIds = avRows.map(r => r.id);
      if (avIds.length) await backupTable('attribute_value_stock', `attributeValueId IN (${avIds.map(()=>'?').join(',')})`, avIds);
    }
  }
  console.log(JSON.stringify({ timestamp: stamp, products, backupTables: tables }, null, 2));
  await conn.end();
})().catch(e => { console.error(e); process.exit(1); });
