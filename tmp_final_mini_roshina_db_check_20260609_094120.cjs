const fs=require('fs'), path=require('path'); const {createRequire}=require('module');
function loadEnv(file){ if(!fs.existsSync(file)) return; for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){ if(!line.trim()||line.trim().startsWith('#')) continue; const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if(!m) continue; let v=m[2]; if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); if(process.env[m[1]]===undefined) process.env[m[1]]=v; }}
loadEnv('.env'); loadEnv('.env.production');
const mysql=createRequire(path.join(process.cwd(),'package.json'))('mysql2/promise');
(async()=>{ const cfg=process.env.DATABASE_URL || {host:process.env.DB_HOST||process.env.MYSQL_HOST||'localhost', user:process.env.DB_USER||process.env.MYSQL_USER, password:process.env.DB_PASSWORD||process.env.MYSQL_PASSWORD, database:process.env.DB_NAME||process.env.MYSQL_DATABASE, port:Number(process.env.DB_PORT||process.env.MYSQL_PORT||3306)}; const db=await mysql.createConnection(cfg);
const ids=[390147,390148,390207];
const [rows]=await db.execute(`SELECT p.id productId,p.name productName,p.sku productSku,p.wcId,pv.id variantId,pv.wcVariantId,pv.sku,pv.name,pv.price,pv.salePrice,pv.isActive,pv.attributes FROM products p JOIN product_variants pv ON pv.productId=p.id WHERE p.id IN (?,?,?) ORDER BY p.id,pv.id`, ids);
console.table(rows.map(r=>({productId:r.productId,variantId:r.variantId,wcVariantId:r.wcVariantId,sku:r.sku,name:r.name,active:r.isActive,attributes:typeof r.attributes==='string'?r.attributes:JSON.stringify(r.attributes)})));
const [counts]=await db.execute(`SELECT productId, COUNT(*) variants, SUM(isActive=1) activeVariants, SUM(wcVariantId IS NULL) appRows, COUNT(DISTINCT name) distinctNames FROM product_variants WHERE productId IN (?,?,?) GROUP BY productId ORDER BY productId`, ids);
console.table(counts);
const [badAttrs]=await db.execute(`SELECT productId,id,name,attributes FROM product_variants WHERE productId IN (?,?,?) AND (JSON_EXTRACT(attributes,'$."33"') IS NULL OR JSON_EXTRACT(attributes,'$."33"') NOT IN ('457','458','459','460')) ORDER BY productId,id`, ids);
console.log('bad attribute rows:', JSON.stringify(badAttrs,null,2));
await db.end(); })().catch(e=>{console.error(e);process.exit(1);});
