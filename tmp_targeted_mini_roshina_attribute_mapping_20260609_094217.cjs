const fs=require('fs'), path=require('path'); const {createRequire}=require('module');
function loadEnv(file){ if(!fs.existsSync(file)) return; for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){ if(!line.trim()||line.trim().startsWith('#')) continue; const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if(!m) continue; let v=m[2]; if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); if(process.env[m[1]]===undefined) process.env[m[1]]=v; }}
loadEnv('.env'); loadEnv('.env.production');
const mysql=createRequire(path.join(process.cwd(),'package.json'))('mysql2/promise');
(async()=>{ const cfg=process.env.DATABASE_URL || {host:process.env.DB_HOST||process.env.MYSQL_HOST||'localhost', user:process.env.DB_USER||process.env.MYSQL_USER, password:process.env.DB_PASSWORD||process.env.MYSQL_PASSWORD, database:process.env.DB_NAME||process.env.MYSQL_DATABASE, port:Number(process.env.DB_PORT||process.env.MYSQL_PORT||3306)}; const db=await mysql.createConnection(cfg);
const [vals]=await db.execute(`SELECT id,attributeId,labelEn,isEnabled,sortOrder FROM attribute_values WHERE attributeId=33 ORDER BY sortOrder,id`);
console.table(vals);
const [rows]=await db.execute(`SELECT p.id productId,p.name productName,pa.id productAttributeId,pa.attributeId,pa.activeValueIds,a.displayType FROM products p JOIN product_attributes pa ON pa.productId=p.id JOIN attributes a ON a.id=pa.attributeId WHERE p.id IN (390147,390148,390207) AND pa.attributeId=33 ORDER BY p.id`);
console.table(rows.map(r=>({productId:r.productId,productName:r.productName,productAttributeId:r.productAttributeId,attributeId:r.attributeId,displayType:r.displayType,activeValueIds:JSON.stringify(r.activeValueIds)})));
const valid=new Set(vals.map(v=>v.id));
for (const r of rows) { const arr=Array.isArray(r.activeValueIds)?r.activeValueIds:JSON.parse(r.activeValueIds||'[]'); const invalid=arr.filter(x=>!valid.has(Number(x))); console.log(`${r.productId} invalidValueIds=${JSON.stringify(invalid)} missingExpected=${JSON.stringify([420,422,428,458].filter(x=>!arr.map(Number).includes(x)))}`); }
await db.end(); })().catch(e=>{console.error(e);process.exit(1);});
