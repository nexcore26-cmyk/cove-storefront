import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

const orderNo = "CVE-MQ54SOKZ";
const productId = 390052;

function onlyRows(res: any): any {
  if (Array.isArray(res) && Array.isArray(res[0])) return res[0];
  if (res?.rows) return res.rows;
  return res;
}
async function q(label: string, query: any) {
  const db = await getDb();
  if (!db) throw new Error("No database connection");
  try {
    const res: any = await db.execute(query);
    const rows = onlyRows(res);
    console.log(`\n--- ${label} ---`);
    console.log(JSON.stringify(rows, null, 2));
    return rows;
  } catch (e: any) {
    console.log(`\n--- ${label} ERROR ---`);
    console.log(e?.cause?.sqlMessage || e.message);
    return [];
  }
}
async function main() {
  const orders: any[] = await q("ORDERS", sql`select id, orderNumber, customerId, customerName, status, paymentStatus, channel, subtotal, total, createdAt, updatedAt from orders where orderNumber = ${orderNo} limit 5`);
  const orderId = orders?.[0]?.id;
  if (orderId) await q("ORDER_ITEMS", sql`select id, orderId, productId, variantId, quantity, qtyValue, unitPrice, totalPrice, name, sku, variantAttributes from order_items where orderId = ${orderId} order by id`);
  await q("PRODUCT", sql`select id, name, slug, sku, type, status, price, salePrice, updatedAt from products where id = ${productId}`);
  await q("VARIANTS", sql`select id, productId, sku, name, attributes, manageStock, price, salePrice, isActive, preOrderEnabled, preOrderLimit, preOrderUsed, updatedAt from product_variants where productId = ${productId} order by id`);
  await q("WAREHOUSES", sql`select id, name, code, type, isActive from warehouses order by id`);
  await q("WAREHOUSE_STOCK_PRODUCT", sql`select id, warehouseId, productId, variantId, quantity, reservedQty, reorderPoint, updatedAt from warehouse_stock where productId = ${productId} order by warehouseId, variantId`);
  await q("WAREHOUSE_STOCK_VARIANTS", sql`select id, warehouseId, productId, variantId, quantity, reservedQty, reorderPoint, updatedAt from warehouse_stock where variantId in (select id from product_variants where productId = ${productId}) order by warehouseId, variantId`);
}
main().catch(e => { console.error(e); process.exit(1); });
