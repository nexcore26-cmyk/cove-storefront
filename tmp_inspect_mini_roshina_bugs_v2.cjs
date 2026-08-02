const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const appRequire = createRequire(path.join(process.cwd(), 'package.json'));
function loadEnv(file){
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if(!m || line.trim().startsWith('#')) continue;
    let v=m[2];
    if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
    if(process.env[m[1]]===undefined) process.env[m[1]]=v;
  }
}
loadEnv(path.join(process.cwd(),'.env'));
loadEnv(path.join(process.cwd(),'.env.production'));
const mysql = appRequire('mysql2/promise');
async function main(){
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL;
  const cfg = url || {host:process.env.DB_HOST||process.env.MYSQL_HOST||'localhost', user:process.env.DB_USER||process.env.MYSQL_USER, password:process.env.DB_PASSWORD||process.env.MYSQL_PASSWORD, database:process.env.DB_NAME||process.env.MYSQL_DATABASE, port:Number(process.env.DB_PORT||process.env.MYSQL_PORT||3306)};
  const db = await mysql.createConnection(cfg);
  const out = {generatedAt:new Date().toISOString()};
  async function q(name, sql, params=[]){ try{ const [rows]=await db.execute(sql,params); out[name]=rows; } catch(e){ out[name+'_error']=e.message; } }
  await q('attribute33', `SELECT * FROM attributes WHERE id=33`);
  await q('attribute_values_33_or_457', `SELECT * FROM attribute_values WHERE attributeId=33 OR id=457 ORDER BY attributeId, sortOrder, id`);
  await q('product_attributes_affected', `SELECT * FROM product_attributes WHERE productId IN (390147,390148,390207) ORDER BY productId, attributeId, id`);
  await q('avs_for_correct_values', `SELECT avs.*, av.attributeId, av.labelEn FROM attribute_value_stock avs LEFT JOIN attribute_values av ON av.id=avs.attributeValueId WHERE avs.attributeValueId IN (453,454,455,456,457) ORDER BY avs.attributeValueId, avs.warehouseId`);
  await q('variants_affected', `SELECT id, productId, sku, name, attributes, image, galleryImages, isActive, price, salePrice, createdAt, updatedAt FROM product_variants WHERE productId IN (390147,390148,390207) ORDER BY productId, id`);
  await q('sku_12554_all_product_variants', `SELECT id, productId, sku, name, attributes, isActive FROM product_variants WHERE sku='12554' ORDER BY productId, id`);
  await q('products_sku_12554', `SELECT id, name, sku, type, status FROM products WHERE sku='12554'`);
  await db.end();
  console.log(JSON.stringify(out,null,2));
}
main().catch(e=>{console.error(e);process.exit(1);});
