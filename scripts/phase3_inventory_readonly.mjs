import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const envFile='/home/manus/cove-storefront/.env';
for (const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)) {
  const m=line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
}
const runId=`media-phase3-inventory-${new Date().toISOString().replace(/[:.]/g,'-')}`;
const reportDir=path.join('/home/manus/cove-storefront/reports', runId);
fs.mkdirSync(reportDir, {recursive:true});
const conn=await mysql.createConnection(process.env.DATABASE_URL);
async function q(sql, params=[]) { const [rows]=await conn.execute(sql, params); return rows; }
async function tableExists(name){ const rows=await q(`SELECT COUNT(*) c FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=?`,[name]); return Number(rows[0].c)>0; }
async function columns(name){ return await q(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? ORDER BY ordinal_position`,[name]); }
const tables=await q(`SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY table_name`);
const tableNames=tables.map(r=>r.TABLE_NAME || r.table_name);
const mediaAssetsExists=await tableExists('media_assets');
const mediaSummary={exists:mediaAssetsExists};
if (mediaAssetsExists) {
  const cols=await columns('media_assets');
  mediaSummary.columns=cols;
  mediaSummary.counts={
    total:(await q(`SELECT COUNT(*) c FROM media_assets`))[0].c,
    active:(await q(`SELECT COUNT(*) c FROM media_assets WHERE COALESCE(isActive, is_active, 1)=1`).catch(()=>q(`SELECT COUNT(*) c FROM media_assets`)))[0].c,
    wordpressMigration:(await q(`SELECT COUNT(*) c FROM media_assets WHERE url LIKE '/media/wordpress-migration/%' OR url LIKE 'media/wordpress-migration/%' OR \`key\` LIKE 'wordpress-migration/%'`).catch(()=>[{c:null}]))[0].c,
    adminUploads:(await q(`SELECT COUNT(*) c FROM media_assets WHERE url LIKE '/media/admin-uploads/%' OR url LIKE 'media/admin-uploads/%' OR \`key\` LIKE 'admin-uploads/%'`).catch(()=>[{c:null}]))[0].c,
  };
  const assetRows=await q(`SELECT * FROM media_assets ORDER BY id`);
  const rows=assetRows.map(r=>({
    id:r.id,
    asset_key:r.key || r.asset_key || '',
    url:r.url || '',
    file_name:r.fileName || r.file_name || r.name || r.originalName || r.original_name || '',
    size_bytes:r.size || r.fileSize || r.file_size || 0,
    raw:r
  })).filter(r=>String(r.url).includes('/media/') || String(r.asset_key).includes('/'));
  fs.writeFileSync(path.join(reportDir,'media_assets_inventory.json'), JSON.stringify(rows,null,2));
}
function walk(dir, prefix='') {
  const rows=[];
  if (!fs.existsSync(dir)) return rows;
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    const p=path.join(dir, ent.name);
    const rel=path.join(prefix, ent.name).replace(/\\/g,'/');
    if (ent.isDirectory()) rows.push(...walk(p, rel));
    else if (ent.isFile()) {
      const st=fs.statSync(p);
      rows.push({relativePath:rel, mediaUrl:'/media/'+rel, size:st.size, mtime:st.mtime.toISOString()});
    }
  }
  return rows;
}
const mediaRoot='/home/manus/cove-storefront/public/media';
const fsRows=walk(mediaRoot);
fs.writeFileSync(path.join(reportDir,'filesystem_media_inventory.json'), JSON.stringify(fsRows,null,2));
const fsSummary={root:mediaRoot, totalFiles:fsRows.length, totalBytes:fsRows.reduce((a,r)=>a+r.size,0), byTopDir:{}};
for (const r of fsRows){ const top=r.relativePath.split('/')[0]||''; fsSummary.byTopDir[top]??={files:0,bytes:0}; fsSummary.byTopDir[top].files++; fsSummary.byTopDir[top].bytes+=r.size; }

const candidateTables=[];
for (const t of tableNames) {
  const cols=await columns(t);
  const textCols=cols.filter(c=>['varchar','text','mediumtext','longtext','json'].includes(String(c.DATA_TYPE||c.data_type).toLowerCase())).map(c=>c.COLUMN_NAME||c.column_name);
  const idCols=cols.map(c=>c.COLUMN_NAME||c.column_name).filter(c=>['id','uuid'].includes(c));
  if (textCols.length) candidateTables.push({table:t, idColumn:idCols[0]||null, textColumns:textCols});
}
const referenceCounts=[];
for (const t of candidateTables) {
  for (const col of t.textColumns) {
    try {
      const rows=await q(`SELECT COUNT(*) totalRows, SUM(CASE WHEN \`${col}\` LIKE '%/media/%' THEN 1 ELSE 0 END) mediaRows, SUM(CASE WHEN \`${col}\` LIKE '%wp-content/uploads%' THEN 1 ELSE 0 END) wpRows, SUM(CASE WHEN \`${col}\` LIKE '%wordpress-migration%' THEN 1 ELSE 0 END) migrationRows, SUM(CASE WHEN \`${col}\` LIKE '%admin-uploads%' THEN 1 ELSE 0 END) adminUploadRows FROM \`${t.table}\``);
      const r=rows[0];
      if (Number(r.mediaRows||0)||Number(r.wpRows||0)||Number(r.migrationRows||0)||Number(r.adminUploadRows||0)) referenceCounts.push({table:t.table,column:col,totalRows:Number(r.totalRows||0),mediaRows:Number(r.mediaRows||0),wpRows:Number(r.wpRows||0),migrationRows:Number(r.migrationRows||0),adminUploadRows:Number(r.adminUploadRows||0)});
    } catch(e) {}
  }
}
fs.writeFileSync(path.join(reportDir,'reference_counts_by_table_column.json'), JSON.stringify(referenceCounts,null,2));
const summary={runId, generatedAt:new Date().toISOString(), mode:'read-only', database:{tableCount:tableNames.length, mediaAssets:mediaSummary}, filesystem:fsSummary, referenceCounts, notes:['No database writes were executed.','No files were moved, overwritten, or deleted.']};
fs.writeFileSync(path.join(reportDir,'phase3_inventory_summary.json'), JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
await conn.end();
