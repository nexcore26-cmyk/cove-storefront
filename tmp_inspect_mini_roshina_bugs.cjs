const fs = require('fs');
const path = require('path');
function loadEnv(file){
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if(!m) continue;
    let v=m[2];
    if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
    if(process.env[m[1]]===undefined) process.env[m[1]]=v;
  }
}
loadEnv(path.join(process.cwd(),'.env'));
loadEnv(path.join(process.cwd(),'.env.production'));
const { createRequire } = require('module');
const appRequire = createRequire(path.join(process.cwd(), 'package.json'));
const mysql = appRequire('mysql2/promise');
async function main(){
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL;
  let cfg;
  if (url) cfg = url;
  else cfg = {host:process.env.DB_HOST||process.env.MYSQL_HOST||'localhost', user:process.env.DB_USER||process.env.MYSQL_USER, password:process.env.DB_PASSWORD||process.env.MYSQL_PASSWORD, database:process.env.DB_NAME||process.env.MYSQL_DATABASE, port:Number(process.env.DB_PORT||process.env.MYSQL_PORT||3306)};
  const db = await mysql.createConnection(cfg);
  const out = {generatedAt:new Date().toISOString()};
  async function q(name, sql, params=[]){
    try { const [rows] = await db.execute(sql, params); out[name]=rows; }
    catch(e){ out[name+'_error'] = e.message; }
  }
  await q('tables', `SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND (table_name LIKE '%product%' OR table_name LIKE '%variant%' OR table_name LIKE '%attribute%' OR table_name LIKE '%stock%') ORDER BY table_name`);
  await q('product_columns', `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='products' ORDER BY ordinal_position`);
  await q('variant_columns', `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='product_variants' ORDER BY ordinal_position`);
  await q('attr_columns', `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name IN ('attributes','attribute_values','product_attributes','product_attribute_values','attribute_value_stock') ORDER BY table_name, ordinal_position`);
  await q('products_390', `SELECT * FROM products WHERE id IN (390147,390148,390207)`);
  await q('mini_products_by_name', `SELECT id, name, slug, sku, type, status FROM products WHERE LOWER(name) LIKE '%mini%roshina%' ORDER BY id`);
  await q('attribute33', `SELECT * FROM attributes WHERE id=33`);
  await q('attribute_values_33_or_457', `SELECT * FROM attribute_values WHERE attribute_id=33 OR id=457 ORDER BY attribute_id, sort_order, id`);
  await q('product_attributes_affected', `SELECT * FROM product_attributes WHERE product_id IN (390147,390148,390207) ORDER BY product_id, id`);
  await q('product_attribute_values_affected', `SELECT * FROM product_attribute_values WHERE product_id IN (390147,390148,390207) OR attribute_value_id=457 ORDER BY product_id, attribute_id, attribute_value_id`);
  await q('avs_affected', `SELECT * FROM attribute_value_stock WHERE product_id IN (390147,390148,390207) OR attribute_value_id=457 ORDER BY product_id, attribute_id, attribute_value_id`);
  await q('variants_affected', `SELECT * FROM product_variants WHERE product_id IN (390147,390148,390207) ORDER BY product_id, id`);
  await q('sku_12554', `SELECT * FROM product_variants WHERE sku='12554' ORDER BY product_id, id`);
  await db.end();
  console.log(JSON.stringify(out, null, 2));
}
main().catch(e=>{console.error(e); process.exit(1);});
