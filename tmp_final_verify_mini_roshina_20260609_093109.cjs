const fs=require('fs'); const path=require('path'); const {createRequire}=require('module');
function loadEnv(file){ if(!fs.existsSync(file)) return; for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){ if(!line.trim()||line.trim().startsWith('#')) continue; const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if(!m) continue; let v=m[2]; if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); if(process.env[m[1]]===undefined) process.env[m[1]]=v; }}
loadEnv('.env'); loadEnv('.env.production');
const mysql=createRequire(path.join(process.cwd(),'package.json'))('mysql2/promise');
(async()=>{
 const cfg=process.env.DATABASE_URL || {host:process.env.DB_HOST||process.env.MYSQL_HOST||'localhost', user:process.env.DB_USER||process.env.MYSQL_USER, password:process.env.DB_PASSWORD||process.env.MYSQL_PASSWORD, database:process.env.DB_NAME||process.env.MYSQL_DATABASE, port:Number(process.env.DB_PORT||process.env.MYSQL_PORT||3306)};
 const db=await mysql.createConnection(cfg);
 const [attrs]=await db.execute('SELECT id,productId,attributeId,activeValueIds FROM product_attributes WHERE productId IN (390147,390148,390207) AND attributeId=33 ORDER BY productId');
 const [summary]=await db.execute('SELECT productId, name, COUNT(*) count, GROUP_CONCAT(id ORDER BY id) ids, GROUP_CONCAT(sku ORDER BY id) skus FROM product_variants WHERE productId IN (390147,390148,390207) GROUP BY productId,name ORDER BY productId,name');
 const [gray]=await db.execute('SELECT id,sku,name,price,cog,attributes FROM product_variants WHERE productId=390148 ORDER BY id');
 const [beige]=await db.execute('SELECT id,sku,name,price,cog,attributes FROM product_variants WHERE productId=390207 ORDER BY id');
 const [refs]=await db.execute('SELECT COUNT(*) AS duplicate_refs FROM product_variants WHERE productId=390207 AND id NOT IN (210095,210096,210097,210098)');
 await db.end();
 console.log(JSON.stringify({attrs, summary, gray, beige, remainingBeigeDuplicates:refs[0].duplicate_refs}, null, 2));
})().catch(e=>{console.error(e);process.exit(1);});
