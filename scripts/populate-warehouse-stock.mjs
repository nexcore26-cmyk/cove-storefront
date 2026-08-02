/**
 * populate-warehouse-stock.mjs
 *
 * Copies stock from MAIN warehouse (id=1) into ONLINE (id=2) and POS (id=3) warehouses.
 * This is a one-time migration needed after the product merge.
 * After this, the nightly sync will keep ONLINE and POS warehouses updated correctly.
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

try {
  // Check current state
  const [before] = await conn.execute(
    'SELECT warehouseId, COUNT(*) as cnt, SUM(quantity) as totalQty FROM warehouse_stock WHERE variantId IS NULL GROUP BY warehouseId'
  );
  console.log('Before migration:', JSON.stringify(before, null, 2));

  // Copy all MAIN warehouse stock rows to ONLINE warehouse (id=2)
  // ON DUPLICATE KEY UPDATE so we don't create duplicates if run twice
  const [onlineResult] = await conn.execute(`
    INSERT INTO warehouse_stock (warehouseId, productId, variantId, quantity, reservedQty, outOfStockThresholdEnabled, outOfStockThreshold)
    SELECT 2, productId, variantId, quantity, 0, 0, 0
    FROM warehouse_stock
    WHERE warehouseId = 1
    ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)
  `);
  console.log('ONLINE warehouse rows inserted/updated:', onlineResult.affectedRows);

  // Copy all MAIN warehouse stock rows to POS warehouse (id=3)
  const [posResult] = await conn.execute(`
    INSERT INTO warehouse_stock (warehouseId, productId, variantId, quantity, reservedQty, outOfStockThresholdEnabled, outOfStockThreshold)
    SELECT 3, productId, variantId, quantity, 0, 0, 0
    FROM warehouse_stock
    WHERE warehouseId = 1
    ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)
  `);
  console.log('POS warehouse rows inserted/updated:', posResult.affectedRows);

  // Check after state
  const [after] = await conn.execute(
    'SELECT warehouseId, COUNT(*) as cnt, SUM(quantity) as totalQty FROM warehouse_stock WHERE variantId IS NULL GROUP BY warehouseId'
  );
  console.log('After migration:', JSON.stringify(after, null, 2));

  console.log('\nDone! ONLINE and POS warehouses now have stock.');
  console.log('Note: The nightly sync will now correctly update ONLINE from main WC and POS from brass WC.');
} finally {
  await conn.end();
}
