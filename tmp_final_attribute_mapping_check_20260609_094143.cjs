const fs=require('fs'), path=require('path'); const {createRequire}=require('module');
function loadEnv(file){ if(!fs.existsSync(file)) return; for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){ if(!line.trim()||line.trim().startsWith('#')) continue; const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if(!m) continue; let v=m[2]; if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); if(process.env[m[1]]===undefined) process.env[m[1]]=v; }}
loadEnv('.env'); loadEnv('.env.production');
const mysql=createRequire(path.join(process.cwd(),'package.json'))('mysql2/promise');
(async()=>{ const cfg=process.env.DATABASE_URL || {host:process.env.DB_HOST||process.env.MYSQL_HOST||'localhost', user:process.env.DB_USER||process.env.MYSQL_USER, password:process.env.DB_PASSWORD||process.env.MYSQL_PASSWORD, database:process.env.DB_NAME||process.env.MYSQL_DATABASE, port:Number(process.env.DB_PORT||process.env.MYSQL_PORT||3306)}; const db=await mysql.createConnection(cfg);
const [tables]=await db.execute("SHOW TABLES LIKE '%attribute%'"); console.log('attribute tables:', tables);
for (const trow of tables) { const t=Object.values(trow)[0]; const [cols]=await db.execute('SHOW COLUMNS FROM `'+t+'`'); console.log('\nTABLE', t, cols.map(c=>c.Field).join(', ')); }
const candidates=['product_attributes','product_attribute_values','attribute_values','attributes','product_attribute_terms','product_attributes_values'];
for (const t of candidates) { try { const [rows]=await db.execute('SELECT * FROM `'+t+'` WHERE '+(t==='attribute_values'?'attributeId=33':'1=1')+' LIMIT 20'); console.log('\nSAMPLE', t, JSON.stringify(rows,null,2)); } catch(e) {} }
try { const [rows]=await db.execute(`SELECT pav.* FROM product_attribute_values pav WHERE productId IN (390147,390148,390207) OR product_id IN (390147,390148,390207) ORDER BY 1 LIMIT 100`); console.log('\nproduct_attribute_values mini rows', JSON.stringify(rows,null,2)); } catch(e) { console.log('specific product_attribute_values query failed:', e.message); }
await db.end(); })().catch(e=>{console.error(e);process.exit(1);});
