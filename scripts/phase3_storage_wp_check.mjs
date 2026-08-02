import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
const envFile='/home/manus/cove-storefront/.env';
for (const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,''); }
const conn=await mysql.createConnection(process.env.DATABASE_URL);
const [pbCols]=await conn.execute("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='page_blocks' ORDER BY ordinal_position");
const cols=pbCols.map(r=>r.COLUMN_NAME||r.column_name);
const selectCols=cols.filter(c=>['id','pageId','page_id','blockType','block_type','name','title','config'].includes(c));
const [pageBlocks]=await conn.execute(`SELECT ${selectCols.map(c=>'`'+c+'`').join(', ')} FROM page_blocks WHERE config LIKE '%wp-content/uploads%'`);
const [orderItems]=await conn.execute("SELECT COUNT(*) AS c FROM order_items WHERE image LIKE '%wp-content/uploads%'");
function countWalk(dir){
  let files=0, bytes=0, sample=[];
  if (!fs.existsSync(dir)) return {exists:false, files, bytes, sample};
  function walk(d, prefix=''){
    for (const ent of fs.readdirSync(d,{withFileTypes:true})){
      const p=path.join(d, ent.name), rel=path.join(prefix, ent.name).replace(/\\/g,'/');
      if(ent.isDirectory()) walk(p, rel); else if(ent.isFile()){ const st=fs.statSync(p); files++; bytes+=st.size; if(sample.length<20) sample.push(rel); }
    }
  }
  walk(dir); return {exists:true, files, bytes, sample};
}
const dirs=['/home/manus/cove-storefront/public/media','/home/manus/cove-storefront/media','/home/manus/cove-storefront/uploads','/home/manus/cove-storefront/public/uploads','/home/manus/cove-storefront/storage','/var/www/cove-storefront/public/media'];
const storage={}; for (const d of dirs) storage[d]=countWalk(d);
console.log(JSON.stringify({pageBlockColumns:cols, pageBlocksWithWpContent:pageBlocks, orderItemsWpImageCount:Number(orderItems[0].c), storage}, null, 2));
await conn.end();
