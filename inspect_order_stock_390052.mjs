import { db } from "./server/db.js";
import { sql } from "drizzle-orm";

const orderNo = "CVE-MQ54SOKZ";
const productId = 390052;

async function q(label, query) {
  try {
    const res = await db.execute(query);
    console.log(`\n--- ${label} ---`);
    console.log(JSON.stringify(res.rows ?? res, null, 2));
    return res.rows ?? res;
  } catch (e) {
    console.log(`\n--- ${label} ERROR ---`);
    console.log(e.message);
    return [];
  }
}

async function main() {
  await q("ORDER TABLE COLUMNS", sql`select column_name from information_schema.columns where table_schema = database() and table_name = orders order by ordinal_position`);
  await q("ORDER ITEMS COLUMNS", sql`select column_name from information_schema.columns where table_schema = database() and table_name = order_items order by ordinal_position`);
  await q("WAREHOUSE STOCK COLUMNS", sql`select column_name from information_schema.columns where table_schema = database() and table_name = warehouse_stock order by ordinal_position`);
  await q("PRODUCT VARIANT COLUMNS", sql`select column_name from information_schema.columns where table_schema = database() and table_name = product_variants order by ordinal_position`);

  const orders = await q("ORDERS", sql`select * from orders where order_number = ${orderNo} limit 5`);
  const orderId = orders?.[0]?.id;
  if (orderId) await q("ORDER_ITEMS", sql`select * from order_items where order_id = ${orderId}`);

  await q("PRODUCT", sql`select * from products where id = ${productId}`);
  await q("VARIANTS", sql`select * from product_variants where product_id = ${productId} order by id`);
  await q("WAREHOUSES", sql`select * from warehouses order by id`);
  await q("WAREHOUSE_STOCK_PRODUCT", sql`select * from warehouse_stock where product_id = ${productId} order by warehouse_id, variant_id`);
  await q("WAREHOUSE_STOCK_VARIANTS", sql`select * from warehouse_stock where variant_id in (select id from product_variants where product_id = ${productId}) order by warehouse_id, variant_id`);
}
main().catch(e => { console.error(e); process.exit(1); });
