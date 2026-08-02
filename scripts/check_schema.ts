import 'dotenv/config';
import mysql from 'mysql2/promise';

async function main() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL!);
  const [r1]: any = await conn.query("SHOW TABLES LIKE 'shipping_classes'");
  console.log('shipping_classes exists:', r1.length > 0);
  const [r2]: any = await conn.query("SHOW TABLES LIKE 'kuwait_city_surcharges'");
  console.log('kuwait_city_surcharges exists:', r2.length > 0);
  const [r3]: any = await conn.query("SHOW COLUMNS FROM products LIKE 'kuwaitOnly'");
  console.log('products.kuwaitOnly exists:', r3.length > 0);
  const [r4]: any = await conn.query("SHOW COLUMNS FROM products LIKE 'shippingClassId'");
  console.log('products.shippingClassId exists:', r4.length > 0);
  const [r5]: any = await conn.query("SHOW COLUMNS FROM store_settings LIKE 'shippingTableRateEnabled'");
  console.log('store_settings.shippingTableRateEnabled exists:', r5.length > 0);
  await conn.end();
}

main().catch(console.error);
