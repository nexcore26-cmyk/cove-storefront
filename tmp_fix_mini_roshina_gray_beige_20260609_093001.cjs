const fs = require('fs');
const path = require('path');
const { createRequire } = require('module');
const stamp = '20260609_093001';
const backupPath = '/home/manus/cove-storefront/backups/mini_roshina_gray_beige_fix_backup_20260609_093001.json';
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
loadEnv('.env'); loadEnv('.env.production');
const mysql = createRequire(path.join(process.cwd(),'package.json'))('mysql2/promise');
const ATTR_NAME = 'Select Mini Roshina box set';
const keepBeigeIds = [210095,210096,210097,210098];
const correctActiveIds = [458,420,428,422];
function j(v){ return JSON.stringify(v); }
async function main(){
  fs.mkdirSync(path.dirname(backupPath), {recursive:true});
  const cfg=process.env.DATABASE_URL || {host:process.env.DB_HOST||process.env.MYSQL_HOST||'localhost', user:process.env.DB_USER||process.env.MYSQL_USER, password:process.env.DB_PASSWORD||process.env.MYSQL_PASSWORD, database:process.env.DB_NAME||process.env.MYSQL_DATABASE, port:Number(process.env.DB_PORT||process.env.MYSQL_PORT||3306)};
  const db=await mysql.createConnection(cfg);
  await db.beginTransaction();
  try {
    const [beforeGrayVariants]=await db.execute('SELECT * FROM product_variants WHERE productId=390148 ORDER BY id');
    const [beforeBeigeVariants]=await db.execute('SELECT * FROM product_variants WHERE productId=390207 ORDER BY id');
    const [beforeAttrs]=await db.execute('SELECT * FROM product_attributes WHERE productId IN (390147,390148,390207) AND attributeId=33 ORDER BY productId');
    const [beforeRelevantValues]=await db.execute('SELECT * FROM attribute_values WHERE id IN (458,420,428,422) ORDER BY id');
    const duplicateIds = beforeBeigeVariants.filter(r => !keepBeigeIds.includes(r.id)).map(r => r.id);
    fs.writeFileSync(backupPath, JSON.stringify({stamp, beforeGrayVariants, beforeBeigeVariants, beforeAttrs, beforeRelevantValues, keepBeigeIds, duplicateIds}, null, 2));

    if (duplicateIds.length) {
      const ph = duplicateIds.map(()=>'?').join(',');
      const [del] = await db.execute(, duplicateIds);
      console.log(); 
    } else {
      console.log('No Beige duplicate variants found to delete.');
    }

    const [attrUpdate] = await db.execute('UPDATE product_attributes SET activeValueIds=? WHERE productId=390148 AND attributeId=33', [JSON.stringify(correctActiveIds)]);
    console.log(); 

    const [grayRows] = await db.execute('SELECT * FROM product_variants WHERE productId=390148 ORDER BY id');
    const byName = Object.fromEntries(grayRows.map(r => [r.name, r]));
    const basicBase = byName['Basic set (Only Box)'];
    const fullBase = byName['Full set (Only Box)'];
    if (!basicBase || !fullBase) throw new Error('Missing Gray base variants; cannot clone missing Mubkhar rows safely.');

    async function insertIfMissing(base, spec){
      const [existing] = await db.execute('SELECT id, sku, name FROM product_variants WHERE productId=390148 AND name=? ORDER BY id', [spec.name]);
      if (existing.length) { console.log(); return existing[0].id; }  
      const attrs = {}; attrs[ATTR_NAME] = spec.name;
      const [res] = await db.execute(, [
          390148, null, spec.sku, spec.name, JSON.stringify(attrs), spec.price, base.salePrice, spec.cog,
          spec.image || base.image, base.weight, base.isActive, JSON.stringify(base.galleryImages || []),
          base.preOrderEnabled, base.preOrderLimit, base.preOrderUsed, base.isDownloadable, base.isVirtual, base.manageStock, base.shippingClassId
        ]);
      console.log();  
      return res.insertId;
    }

    await insertIfMissing(basicBase, {
      sku: '12554-BASIC-MUB',
      name: 'Basic set + Roshina Mubkhar',
      price: '55.000',
      cog: '19.200',
      image: basicBase.image
    });
    await insertIfMissing(fullBase, {
      sku: '12554-FULL-MUB',
      name: 'Full set + Roshina Mubkhar',
      price: '78.000',
      cog: '35.500',
      image: fullBase.image
    });

    const [afterGrayVariants]=await db.execute('SELECT id,productId,sku,name,attributes,price,cog,image FROM product_variants WHERE productId=390148 ORDER BY id');
    const [afterBeigeSummary]=await db.execute('SELECT name, COUNT(*) count, MIN(id) firstId, MAX(id) lastId FROM product_variants WHERE productId=390207 GROUP BY name ORDER BY name');
    const [afterAttrs]=await db.execute('SELECT id,productId,attributeId,activeValueIds FROM product_attributes WHERE productId IN (390147,390148,390207) AND attributeId=33 ORDER BY productId');
    await db.commit();
    console.log(JSON.stringify({backupPath, afterGrayVariants, afterBeigeSummary, afterAttrs}, null, 2));
  } catch (e) {
    await db.rollback();
    console.error('Rolled back because of error:', e);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}
main();
