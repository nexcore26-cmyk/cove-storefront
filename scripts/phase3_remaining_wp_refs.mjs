import mysql from 'mysql2/promise';
import fs from 'fs';
const envFile='/home/manus/cove-storefront/.env';
for (const line of fs.readFileSync(envFile,'utf8').split(/\r?\n/)) { const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,''); }
const conn=await mysql.createConnection(process.env.DATABASE_URL);
const [pageBlocks]=await conn.execute("SELECT id, pageId, type, LEFT(config, 1000) AS config_sample FROM page_blocks WHERE config LIKE '%wp-content/uploads%'");
const [orderItems]=await conn.execute("SELECT COUNT(*) AS c FROM order_items WHERE image LIKE '%wp-content/uploads%'");
console.log(JSON.stringify({pageBlocks, orderItemsWpImageCount: Number(orderItems[0].c)}, null, 2));
await conn.end();
