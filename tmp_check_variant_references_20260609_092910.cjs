const fs=require('fs'); const path=require('path'); const {createRequire}=require('module');
function loadEnv(file){ if(!fs.existsSync(file)) return; for(const line of fs.readFileSync(file,'utf8').split(/\r?\n/)){ if(!line.trim()||line.trim().startsWith('#')) continue; const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/); if(!m) continue; let v=m[2]; if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1); if(process.env[m[1]]===undefined) process.env[m[1]]=v; }}
loadEnv('.env'); loadEnv('.env.production');
const mysql=createRequire(path.join(process.cwd(),'package.json'))('mysql2/promise');
(async()=>{
 const cfg=process.env.DATABASE_URL || {host:process.env.DB_HOST||process.env.MYSQL_HOST||'localhost', user:process.env.DB_USER||process.env.MYSQL_USER, password:process.env.DB_PASSWORD||process.env.MYSQL_PASSWORD, database:process.env.DB_NAME||process.env.MYSQL_DATABASE, port:Number(process.env.DB_PORT||process.env.MYSQL_PORT||3306)};
 const db=await mysql.createConnection(cfg);
 const [dupIdsRows]=await db.execute('SELECT id FROM product_variants WHERE productId=390207 AND id NOT IN (210095,210096,210097,210098) ORDER BY id');
 const ids=dupIdsRows.map(r=>r.id);
 const [tables]=await db.execute('SHOW TABLES');
 const tableNames=tables.map(r=>Object.values(r)[0]);
 const results={duplicateVariantIds:ids, references:{}};
 for (const t of tableNames){
   const [cols]=await db.execute(`SHOW COLUMNS FROM \`${t}\``);
   const candidateCols=cols.filter(c=>/variant/i.test(c.Field)).map(c=>c.Field);
   for (const col of candidateCols){
     if (!ids.length) continue;
     const placeholders=ids.map(()=>'?').join(',');
     try {
       const [cnt]=await db.execute(`SELECT COUNT(*) AS count FROM \`${t}\` WHERE \`${col}\` IN (${placeholders})`, ids);
       if (cnt[0].count>0){
         const [sample]=await db.execute(`SELECT * FROM \`${t}\` WHERE \`${col}\` IN (${placeholders}) LIMIT 5`, ids);
         results.references[`${t}.${col}`]={count:cnt[0].count, sample};
       }
     } catch(e) {
       results.references[`${t}.${col}`]={error:e.message};
     }
   }
 }
 await db.end();
 console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
