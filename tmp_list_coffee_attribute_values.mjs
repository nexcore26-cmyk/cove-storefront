import mysql from 'mysql2/promise';
import fs from 'node:fs';
function readDatabaseUrl(){ if(process.env.DATABASE_URL) return process.env.DATABASE_URL; const t=fs.readFileSync('.env','utf8'); const m=t.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/m); return m ? m[1].replace(/^['\"]|['\"]$/g,'') : ''; }
const conn=await mysql.createConnection(readDatabaseUrl());
const [rows]=await conn.query(`
SELECT a.id AS attributeId, a.name AS attributeName, a.displayType, av.id AS valueId, av.labelEn, av.swatch, av.image
FROM attributes a
JOIN attribute_values av ON av.attributeId=a.id
WHERE a.id IN (18,19,20,21,22)
ORDER BY a.id, av.sortOrder, av.id
`);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
