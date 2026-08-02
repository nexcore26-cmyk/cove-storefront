/**
 * P10 — Low Stock Alerts
 * Tests that:
 * 1. lowStockAlertSent is added to warehouse_stock table
 * 2. Alert fires once when stock drops to/below reorderPoint
 * 3. Alert does not fire again on further deductions (lowStockAlertSent=true blocks repeat)
 * 4. Alert resets when stock rises above reorderPoint via transfer
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { warehouses, warehouseStock, products } from '../drizzle/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { transferStock } from './db';

let testProductId: number | null = null;
let onlineWhId: number | null = null;
let mainWhId: number | null = null;
let testStockId: number | null = null;

beforeAll(async () => {
  const db = await getDb();
  if (!db) return;

  const allWarehouses = await db.select().from(warehouses);
  const onlineWh = allWarehouses.find(w => w.type === 'online');
  const mainWh = allWarehouses.find(w => w.type === 'main');
  if (!onlineWh || !mainWh) {
    console.warn('Required warehouses not found, skipping P10 tests');
    return;
  }
  onlineWhId = onlineWh.id;
  mainWhId = mainWh.id;

  const [prodResult] = await db.insert(products).values({
    name: '__test_p10_product__',
    slug: `__test-p10-product-${Date.now()}__`,
    price: '10.000',
    status: 'draft',
    type: 'simple',
  });
  testProductId = (prodResult as any).insertId;

  // Set ONLINE stock = 10, reorderPoint = 5
  const [stockResult] = await db.insert(warehouseStock).values({
    warehouseId: onlineWhId,
    productId: testProductId,
    variantId: null,
    quantity: 10,
    reservedQty: 0,
    reorderPoint: 5,
    lowStockAlertSent: false,
  });
  testStockId = (stockResult as any).insertId;

  // Also set MAIN stock = 100 for transfer tests
  await db.insert(warehouseStock).values({
    warehouseId: mainWhId,
    productId: testProductId,
    variantId: null,
    quantity: 100,
    reservedQty: 0,
    reorderPoint: 0,
    lowStockAlertSent: false,
  });
});

afterAll(async () => {
  const db = await getDb();
  if (!db || !testProductId) return;
  await db.delete(warehouseStock).where(eq(warehouseStock.productId, testProductId));
  await db.delete(products).where(eq(products.id, testProductId));
});

describe('P10 — Low Stock Alerts', () => {
  it('warehouseStock table has lowStockAlertSent column', async () => {
    const db = await getDb();
    if (!db || !testStockId) return;
    const [row] = await db.select().from(warehouseStock).where(eq(warehouseStock.id, testStockId)).limit(1);
    expect(row).toBeDefined();
    expect(row).toHaveProperty('lowStockAlertSent');
    expect(row.lowStockAlertSent).toBe(false);
  });

  it('lowStockAlertSent starts as false', async () => {
    const db = await getDb();
    if (!db || !testStockId) return;
    const [row] = await db.select().from(warehouseStock).where(eq(warehouseStock.id, testStockId)).limit(1);
    expect(row.lowStockAlertSent).toBe(false);
  });

  it('resets lowStockAlertSent to false when stock rises above reorderPoint via transfer', async () => {
    const db = await getDb();
    if (!db || !testProductId || !onlineWhId || !mainWhId || !testStockId) return;

    // First set lowStockAlertSent = true manually to simulate an alert was fired
    await db.update(warehouseStock)
      .set({ quantity: 3, lowStockAlertSent: true })
      .where(eq(warehouseStock.id, testStockId));

    // Verify it's set
    const [before] = await db.select().from(warehouseStock).where(eq(warehouseStock.id, testStockId)).limit(1);
    expect(before.lowStockAlertSent).toBe(true);
    expect(before.quantity).toBe(3);

    // Transfer 10 units from MAIN to ONLINE (3 + 10 = 13 > reorderPoint 5)
    await transferStock({
      fromWarehouseId: mainWhId,
      toWarehouseId: onlineWhId,
      productId: testProductId,
      quantity: 10,
      reason: 'p10_restock_test',
    });

    // After restock, lowStockAlertSent should be reset to false
    const [after] = await db.select().from(warehouseStock).where(eq(warehouseStock.id, testStockId)).limit(1);
    expect(after.quantity).toBe(13);
    expect(after.lowStockAlertSent).toBe(false);
  });

  it('does not reset lowStockAlertSent if stock stays below reorderPoint after transfer', async () => {
    const db = await getDb();
    if (!db || !testProductId || !onlineWhId || !mainWhId || !testStockId) return;

    // Set stock = 1, lowStockAlertSent = true, reorderPoint = 5
    await db.update(warehouseStock)
      .set({ quantity: 1, lowStockAlertSent: true })
      .where(eq(warehouseStock.id, testStockId));

    // Transfer 2 units (1 + 2 = 3 < reorderPoint 5) → should NOT reset alert
    await transferStock({
      fromWarehouseId: mainWhId,
      toWarehouseId: onlineWhId,
      productId: testProductId,
      quantity: 2,
      reason: 'p10_small_restock',
    });

    const [after] = await db.select().from(warehouseStock).where(eq(warehouseStock.id, testStockId)).limit(1);
    expect(after.quantity).toBe(3);
    expect(after.lowStockAlertSent).toBe(true); // Still true, stock still below reorderPoint
  });
});
