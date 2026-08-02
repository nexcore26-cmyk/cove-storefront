const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const appRequire = createRequire(path.join(process.cwd(), 'package.json'));
function loadEnv(file){
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if(!m) continue;
    let v=m[2];
    if ((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
    if(process.env[m[1]]===undefined) process.env[m[1]]=v;
  }
}
loadEnv(path.join(process.cwd(),'.env'));
loadEnv(path.join(process.cwd(),'.env.production'));
const mysql = appRequire('mysql2/promise');
const stamp = process.argv[2];
async function main(){
  const url = process.env.DATABASE_URL || process.env.MYSQL_URL;
  const cfg = url || {host:process.env.DB_HOST||process.env.MYSQL_HOST||'localhost', user:process.env.DB_USER||process.env.MYSQL_USER, password:process.env.DB_PASSWORD||process.env.MYSQL_PASSWORD, database:process.env.DB_NAME||process.env.MYSQL_DATABASE, port:Number(process.env.DB_PORT||process.env.MYSQL_PORT||3306), multipleStatements:true};
  if (typeof cfg === 'string') {
    // mysql2 URL connections do not enable multiple statements by default; avoid needing them.
  }
  const db = await mysql.createConnection(cfg);
  const out = {stamp, startedAt:new Date().toISOString(), backupTables:[]};
  await db.beginTransaction();
  try {
    const tables = [
      ['products', `SELECT * FROM products WHERE id IN (390148,390207)`],
      ['product_attributes', `SELECT * FROM product_attributes WHERE productId IN (390148,390207) OR id=142`],
      ['attribute_values', `SELECT * FROM attribute_values WHERE attributeId=33 OR id IN (457,458,420,428,422)`],
      ['product_variants', `SELECT * FROM product_variants WHERE productId IN (390148,390207) OR id IN (210147,210148)`]
    ];
    for (const [table, selectSql] of tables) {
      const backup = `bk_mr_bug_${table}_${stamp}`.slice(0,63);
      await db.query(`CREATE TABLE \`${backup}\` AS ${selectSql}`);
      const [cnt] = await db.query(`SELECT COUNT(*) AS count FROM \`${backup}\``);
      out.backupTables.push({table, backup, count: cnt[0].count});
    }

    const [beforePA] = await db.execute(`SELECT * FROM product_attributes WHERE id=142 FOR UPDATE`);
    const [beforeGray] = await db.execute(`SELECT id, productId, sku, name, attributes FROM product_variants WHERE id IN (210147,210148) FOR UPDATE`);
    out.before = {beigeProductAttribute: beforePA, grayVariants: beforeGray};

    await db.execute(`UPDATE product_attributes SET activeValueIds = CAST(? AS JSON) WHERE id=142 AND productId=390207 AND attributeId=33`, [JSON.stringify([458,420,428,422])]);

    await db.execute(`UPDATE product_variants SET sku=? WHERE id=? AND productId=?`, ['12554-BASIC', 210147, 390148]);
    await db.execute(`UPDATE product_variants SET sku=? WHERE id=? AND productId=?`, ['12554-FULL', 210148, 390148]);

    const [afterPA] = await db.execute(`SELECT * FROM product_attributes WHERE id=142`);
    const [afterGray] = await db.execute(`SELECT id, productId, sku, name, attributes FROM product_variants WHERE id IN (210147,210148)`);
    out.after = {beigeProductAttribute: afterPA, grayVariants: afterGray};

    await db.commit();
    out.committed = true;
  } catch (e) {
    await db.rollback();
    out.committed = false;
    out.error = e.stack || e.message;
    console.log(JSON.stringify(out,null,2));
    process.exitCode = 1;
  } finally {
    await db.end();
  }
  out.finishedAt = new Date().toISOString();
  console.log(JSON.stringify(out,null,2));
}
main().catch(e=>{console.error(e);process.exit(1);});
