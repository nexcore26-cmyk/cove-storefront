import mysql from 'mysql2/promise';
import fs from 'fs';
const envFile='/home/manus/cove-storefront/.env';
for (const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)) {
  const m=line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
}
const conn=await mysql.createConnection(process.env.DATABASE_URL);
const [rows]=await conn.execute("SELECT id, pageId, blockType, config FROM page_blocks WHERE config LIKE '%wp-content/uploads%'");
const targetCandidates=[
  '/media/wordpress-migration/2022/07/1-feature-ar.jpg',
  '/media/wordpress-migration/2022/07/1.png',
  '/media/wordpress-migration/2022/07/1-feature-ar.jpeg',
  '/media/wordpress-migration/2022/07/1-feature.jpg'
];
const [assets]=await conn.query(`SELECT id, \`key\`, url, sourceUrl, originalFilename, mimeType, sizeBytes, sha256 FROM media_assets WHERE url IN (${targetCandidates.map(()=>'?').join(',')}) OR sourceUrl LIKE '%1-feature-ar%' OR originalFilename LIKE '%1-feature-ar%' ORDER BY id`, targetCandidates);
await conn.end();
console.log(JSON.stringify({remainingPageBlocks: rows, targetCandidates, matchingMediaAssets: assets}, null, 2));
