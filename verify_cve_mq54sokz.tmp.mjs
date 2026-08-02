import "dotenv/config";
import mysql from "mysql2/promise";
const conn = await mysql.createConnection(process.env.DATABASE_URL);
try {
  const [rows] = await conn.execute(`
    SELECT o.id orderId, o.orderNumber, o.channel, o.status, o.paymentStatus,
           oi.productId, oi.variantId, oi.quantity orderQty,
           SUM(CASE WHEN w.type=online THEN ws.quantity ELSE 0 END) onlineTotal,
           SUM(CASE WHEN w.type=pos THEN ws.quantity ELSE 0 END) posTotal,
           MAX(CASE WHEN o.internalNotes LIKE %[system:stock_deducted_at_order_placement:% THEN 1 ELSE 0 END) hasDeductionMarker
    FROM orders o
    JOIN order_items oi ON oi.orderId = o.id
    JOIN warehouse_stock ws ON ws.productId = oi.productId
    JOIN warehouses w ON w.id = ws.warehouseId AND w.type IN (online,pos)
    WHERE o.orderNumber = ? AND oi.productId = ?
    GROUP BY o.id, o.orderNumber, o.channel, o.status, o.paymentStatus, oi.productId, oi.variantId, oi.quantity
  `, ["CVE-MQ54SOKZ", 390052]);
  const [stockRows] = await conn.execute(`
    SELECT ws.id, w.name warehouse, w.type, ws.productId, ws.variantId, ws.quantity
    FROM warehouse_stock ws JOIN warehouses w ON w.id = ws.warehouseId
    WHERE ws.productId = ? AND w.type IN (online,pos)
    ORDER BY w.id, ws.variantId IS NOT NULL, ws.variantId
  `, [390052]);
  console.log(JSON.stringify({ verification: rows, stockRows }, null, 2));
} finally { await conn.end(); }
