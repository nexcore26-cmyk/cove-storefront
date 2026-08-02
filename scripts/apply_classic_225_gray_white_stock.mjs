import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

const appDir = process.cwd();
dotenv.config({ path: path.join(appDir, '.env') });
dotenv.config({ path: path.join(appDir, '.env.production') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run from the production app directory with .env available.');
  process.exit(1);
}

const PRODUCT_ID = 390057;
const VARIANT_ID = 331466; // 225 Classic Gray / White
const TARGET_QTY = 10;
const ONLINE_WAREHOUSE_TYPE = 'online';
const reason = '[ADJ:CORRECTION:+] Direct correction requested by owner: set Classic 225 Gray / White Website stock to 10';

const conn = await mysql.createConnection(DATABASE_URL);
try {
  await conn.beginTransaction();

  const [warehouses] = await conn.query(
    'SELECT id, name, code, type FROM warehouses WHERE type = ? ORDER BY id LIMIT 1',
    [ONLINE_WAREHOUSE_TYPE]
  );
  if (warehouses.length === 0) throw new Error('No online Website warehouse found');
  const websiteWarehouse = warehouses[0];

  const [variants] = await conn.query(
    'SELECT id, productId, name, sku, attributes FROM product_variants WHERE id = ? AND productId = ? LIMIT 1',
    [VARIANT_ID, PRODUCT_ID]
  );
  if (variants.length === 0) throw new Error(`Variant ${VARIANT_ID} for product ${PRODUCT_ID} not found`);

  const [beforeRows] = await conn.query(
    `SELECT ws.*, w.name AS warehouseName, w.type AS warehouseType, pv.name AS variantName
       FROM warehouse_stock ws
       JOIN warehouses w ON w.id = ws.warehouseId
       LEFT JOIN product_variants pv ON pv.id = ws.variantId
      WHERE ws.productId = ?
      ORDER BY ws.warehouseId, ws.variantId IS NULL, ws.variantId, ws.id`,
    [PRODUCT_ID]
  );

  const backupDir = '/home/manus/cove-backups/direct-gray-white-stock-correction';
  await fs.mkdir(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const backupPath = path.join(backupDir, `product-${PRODUCT_ID}-warehouse-stock-before-${timestamp}.json`);
  await fs.writeFile(backupPath, JSON.stringify({
    createdAt: new Date().toISOString(),
    action: 'Before direct correction of Classic 225 Gray / White Website stock',
    productId: PRODUCT_ID,
    variantId: VARIANT_ID,
    targetQuantity: TARGET_QTY,
    websiteWarehouse,
    variant: variants[0],
    warehouseStockRows: beforeRows,
  }, null, 2));

  const [existingRows] = await conn.query(
    'SELECT * FROM warehouse_stock WHERE warehouseId = ? AND productId = ? AND variantId = ? ORDER BY id',
    [websiteWarehouse.id, PRODUCT_ID, VARIANT_ID]
  );

  let oldQty = 0;
  if (existingRows.length === 0) {
    await conn.query(
      `INSERT INTO warehouse_stock
        (warehouseId, productId, variantId, quantity, reservedQty, reorderPoint, outOfStockThresholdEnabled, outOfStockThreshold, lowStockAlertSent, updatedAt)
       VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, NOW())`,
      [websiteWarehouse.id, PRODUCT_ID, VARIANT_ID, TARGET_QTY]
    );
    oldQty = 0;
  } else {
    oldQty = Number(existingRows[0].quantity ?? 0);
    await conn.query(
      'UPDATE warehouse_stock SET quantity = ?, updatedAt = NOW() WHERE id = ?',
      [TARGET_QTY, existingRows[0].id]
    );
    if (existingRows.length > 1) {
      const duplicateIds = existingRows.slice(1).map((row) => row.id);
      await conn.query(
        `UPDATE warehouse_stock SET quantity = 0, updatedAt = NOW() WHERE id IN (${duplicateIds.map(() => '?').join(',')})`,
        duplicateIds
      );
    }
  }

  const delta = TARGET_QTY - oldQty;
  await conn.query(
    `INSERT INTO stock_transfers
      (fromWarehouseId, toWarehouseId, productId, variantId, quantity, reason, notes, status, createdBy, createdAt, completedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', NULL, NOW(), NOW())`,
    [
      websiteWarehouse.id,
      websiteWarehouse.id,
      PRODUCT_ID,
      VARIANT_ID,
      Math.abs(delta),
      reason,
      `Backup: ${backupPath}; old quantity ${oldQty}; new quantity ${TARGET_QTY}`,
    ]
  );

  const [afterRows] = await conn.query(
    `SELECT ws.*, w.name AS warehouseName, w.type AS warehouseType, pv.name AS variantName
       FROM warehouse_stock ws
       JOIN warehouses w ON w.id = ws.warehouseId
       LEFT JOIN product_variants pv ON pv.id = ws.variantId
      WHERE ws.productId = ?
      ORDER BY ws.warehouseId, ws.variantId IS NULL, ws.variantId, ws.id`,
    [PRODUCT_ID]
  );

  await conn.commit();

  const websiteVariationTotal = afterRows
    .filter((row) => Number(row.warehouseId) === Number(websiteWarehouse.id) && row.variantId !== null)
    .reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);

  console.log(JSON.stringify({
    success: true,
    backupPath,
    websiteWarehouse,
    correctedVariant: variants[0],
    oldQty,
    targetQty: TARGET_QTY,
    delta,
    websiteVariationTotal,
    afterRows,
  }, null, 2));
} catch (error) {
  await conn.rollback();
  console.error(error);
  process.exitCode = 1;
} finally {
  await conn.end();
}
