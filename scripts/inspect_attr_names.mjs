import dotenv from "dotenv";
import mysql from "mysql2/promise";
import fs from "fs";
if (fs.existsSync(".env")) dotenv.config({ path: ".env" });
const conn = await mysql.createConnection(process.env.DATABASE_URL);
const [rows] = await conn.execute(`
  select a.id, a.name, a.displayType, a.type, count(av.id) as valueCount,
         sum(case when av.image is not null and av.image <> '' then 1 else 0 end) as imageValueCount
  from attributes a
  left join attribute_values av on av.attributeId=a.id
  where lower(a.name) like '%steel%'
     or lower(a.name) like '%surface%'
     or lower(a.name) like '%coffee%'
     or lower(a.name) like '%capsule%'
     or lower(a.name) like '%color%'
     or lower(a.name) like '%size%'
  group by a.id, a.name, a.displayType, a.type
  order by a.name, a.id
`);
console.log(JSON.stringify(rows, null, 2));
await conn.end();
