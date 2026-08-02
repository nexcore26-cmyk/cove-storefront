import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
const runId=process.argv[2];
const envFile='/home/manus/cove-storefront/.env';
for (const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)) {
  const m=line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');
}
const conn=await mysql.createConnection(process.env.DATABASE_URL);
const [rows]=await conn.execute(`SELECT runId, COUNT(*) AS backupRows, SUM(tableName='products') AS productRows, SUM(tableName='categories') AS categoryRows, SUM(tableName='page_blocks') AS pageBlockRows FROM media_reference_migration_backups WHERE runId=? GROUP BY runId`, [runId]);
await conn.end();
console.log(JSON.stringify(rows[0]||{runId,backupRows:0}, null, 2));
