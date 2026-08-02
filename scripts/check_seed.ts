import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const [sc]: any = await conn.query("SELECT COUNT(*) as cnt FROM shipping_classes");
  const [cities]: any = await conn.query("SELECT COUNT(*) as cnt FROM kuwait_city_surcharges");
  const [linked]: any = await conn.query("SELECT COUNT(*) as cnt FROM products WHERE shippingClassId IS NOT NULL");
  const [total]: any = await conn.query("SELECT COUNT(*) as cnt FROM products");
  console.log('Shipping classes:', sc[0].cnt);
  console.log('Kuwait cities:', cities[0].cnt);
  console.log('Products with shippingClassId:', linked[0].cnt, '/', total[0].cnt);
  const [classes]: any = await conn.query("SELECT name, slug, kuwaitCost, gccCostPerUnit, kuwaitOnly FROM shipping_classes");
  console.log('\nShipping classes:');
  classes.forEach((c: any) => console.log(`  ${c.name} | KW: ${c.kuwaitCost} | GCC: ${c.gccCostPerUnit}/unit | KW-only: ${c.kuwaitOnly}`));
  await conn.end();
}
main().catch(console.error);
