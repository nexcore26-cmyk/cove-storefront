import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

const envFile='/home/manus/cove-storefront/.env';
for (const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)) {
  const m=line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
}
const runId=`media-phase3-dryrun-${new Date().toISOString().replace(/[:.]/g,'-')}`;
const reportDir=path.join('/home/manus/cove-storefront/reports', runId);
fs.mkdirSync(reportDir, {recursive:true});
const conn=await mysql.createConnection(process.env.DATABASE_URL);
async function q(sql, params=[]) { const [rows]=await conn.execute(sql, params); return rows; }
function walk(dir, prefix='') {
  const rows=[];
  if (!fs.existsSync(dir)) return rows;
  for (const ent of fs.readdirSync(dir, {withFileTypes:true})) {
    const p=path.join(dir, ent.name);
    const rel=path.join(prefix, ent.name).replace(/\\/g,'/');
    if (ent.isDirectory()) rows.push(...walk(p, rel));
    else if (ent.isFile()) { const st=fs.statSync(p); rows.push({url:'/media/'+rel, path:p, relativePath:rel, size:st.size}); }
  }
  return rows;
}
function extractMediaUrls(value) {
  const s=String(value ?? '');
  const out=new Set();
  for (const m of s.matchAll(/\/media\/[A-Za-z0-9_.,%()\-+&=@~!#$;'\[\]{}\/]+/g)) out.add(m[0].replace(/["'\])},.]+$/,''));
  return [...out];
}
function extractWpUrls(value) {
  const s=String(value ?? '');
  const out=new Set();
  for (const m of s.matchAll(/https?:\/\/[^\s"'<>]+wp-content\/uploads\/[^\s"'<>]+/g)) out.add(m[0].replace(/["'\])},.]+$/,''));
  return [...out];
}
const fsRows=walk('/home/manus/cove-storefront/public/media');
const fsUrls=new Set(fsRows.map(r=>r.url));
const assetRows=await q(`SELECT * FROM media_assets ORDER BY id`);
const assetByUrl=new Map();
for (const r of assetRows) {
  const url=r.url || '';
  if (!assetByUrl.has(url)) assetByUrl.set(url, []);
  assetByUrl.get(url).push(r);
}
const usage=[];
const targets=[
  {table:'products', id:'id', cols:['images']},
  {table:'categories', id:'id', cols:['image']},
  {table:'page_blocks', id:'id', cols:['config']},
  {table:'product_variants', id:'id', cols:['image','galleryImages']},
  {table:'order_items', id:'id', cols:['image']},
];
for (const t of targets) {
  try {
    const rows=await q(`SELECT * FROM \`${t.table}\``);
    for (const row of rows) {
      for (const col of t.cols) {
        const val=row[col];
        for (const url of extractMediaUrls(val)) usage.push({url, table:t.table, id:row[t.id], column:col, type:'node_media'});
        for (const url of extractWpUrls(val)) usage.push({url, table:t.table, id:row[t.id], column:col, type:'wordpress_media'});
      }
    }
  } catch(e) {}
}
const usageByUrl=new Map();
for (const u of usage.filter(x=>x.type==='node_media')) {
  if (!usageByUrl.has(u.url)) usageByUrl.set(u.url, []);
  usageByUrl.get(u.url).push(u);
}
const candidates=[];
for (const r of assetRows) {
  const url=r.url || '';
  if (!url.startsWith('/media/')) continue;
  const onDisk=fsUrls.has(url);
  const referenced=(usageByUrl.get(url)||[]).filter(u=>u.table!=='media_assets');
  let classification='retain';
  let recommendation='retain_no_action';
  let reason='asset_available_or_referenced';
  if (!onDisk) { classification='blocked_cleanup_risk'; recommendation='do_not_delete_record_until_missing_file_investigated'; reason='media_library_record_points_to_missing_filesystem_file'; }
  else if (!referenced.length && url.startsWith('/media/wordpress-migration/')) { classification='cleanup_candidate_review_only'; recommendation='candidate_for_future_media_library_cleanup_after_manual_approval'; reason='wordpress_migration_asset_on_disk_but_not_currently_referenced_by_products_categories_pages_or_variants'; }
  else if (!referenced.length && url.startsWith('/media/admin-uploads/')) { classification='retain'; recommendation='retain_admin_upload'; reason='admin_upload_not_a_wordpress_cleanup_target'; }
  candidates.push({kind:'media_asset', id:r.id, url, key:r.key||'', onDisk, referenceCount:referenced.length, referencedAt:referenced.map(x=>`${x.table}.${x.column}#${x.id}`).slice(0,20).join(';'), classification, recommendation, reason});
}
for (const f of fsRows) {
  if (!assetByUrl.has(f.url)) candidates.push({kind:'filesystem_file', id:'', url:f.url, key:'', onDisk:true, referenceCount:(usageByUrl.get(f.url)||[]).length, referencedAt:(usageByUrl.get(f.url)||[]).map(x=>`${x.table}.${x.column}#${x.id}`).slice(0,20).join(';'), classification:'cleanup_candidate_review_only', recommendation:'candidate_for_future_filesystem_review_after_media_library_check', reason:'file_exists_without_media_assets_record'});
}
for (const u of usage.filter(x=>x.type==='node_media')) {
  if (!fsUrls.has(u.url)) candidates.push({kind:'broken_current_reference', id:u.id, url:u.url, key:'', onDisk:false, referenceCount:1, referencedAt:`${u.table}.${u.column}#${u.id}`, classification:'blocked_fix_required', recommendation:'investigate_broken_node_media_reference', reason:'current_database_reference_points_to_missing_file'});
}
const wpUsage=usage.filter(x=>x.type==='wordpress_media');
for (const u of wpUsage) {
  let classification='manual_review_only';
  let recommendation='do_not_auto_rewrite';
  let reason='remaining_wordpress_url_requires_context_review';
  if (u.table==='order_items') { classification='retain_historical_order_snapshot'; recommendation='do_not_rewrite_order_history'; reason='order_item_image_is_historical_transaction_snapshot'; }
  if (u.table==='page_blocks') { classification='remaining_cms_reference_review'; recommendation='inspect_page_builder_block_before_rewrite'; reason='remaining_wordpress_url_in_page_block_after_phase2'; }
  candidates.push({kind:'remaining_wordpress_reference', id:u.id, url:u.url, key:'', onDisk:null, referenceCount:1, referencedAt:`${u.table}.${u.column}#${u.id}`, classification, recommendation, reason});
}
function csvEscape(v){ return '"'+String(v??'').replace(/"/g,'""')+'"'; }
const cols=['kind','id','url','key','onDisk','referenceCount','referencedAt','classification','recommendation','reason'];
fs.writeFileSync(path.join(reportDir,'phase3_candidates.csv'), [cols.join(','), ...candidates.map(r=>cols.map(c=>csvEscape(r[c])).join(','))].join('\n')+'\n');
const summary={runId, generatedAt:new Date().toISOString(), mode:'dry-run-read-only', totals:{mediaAssetRows:assetRows.length, filesystemFiles:fsRows.length, currentNodeMediaReferences:usage.filter(x=>x.type==='node_media').length, remainingWordpressReferences:wpUsage.length, candidateRows:candidates.length}, candidateCounts:candidates.reduce((a,r)=>{a[r.classification]=(a[r.classification]||0)+1; return a;},{}), recommendationCounts:candidates.reduce((a,r)=>{a[r.recommendation]=(a[r.recommendation]||0)+1; return a;},{}), safeguards:['No database writes executed','No filesystem changes executed','All cleanup candidates are review-only until explicit approval']};
fs.writeFileSync(path.join(reportDir,'phase3_dryrun_summary.json'), JSON.stringify(summary,null,2));
fs.writeFileSync(path.join(reportDir,'phase3_usage.json'), JSON.stringify(usage,null,2));
console.log(JSON.stringify(summary,null,2));
await conn.end();
