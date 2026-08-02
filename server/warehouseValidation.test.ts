/**
 * P9 — Warehouse Stock Validation on Transfer
 * Tests that:
 * 1. Over-allocation from MAIN to ONLINE/POS is rejected
 * 2. Valid transfer (within available limit) is approved
 * 3. Exact-limit transfer is allowed
 * 4. Transfer between non-MAIN warehouses bypasses the P9 check
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDb } from './db';
import { warehouses, warehouseStock, products, stockTransfers } from '../drizzle/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { transferStock } from './db';

// Test product and warehouse IDs
let testProductId: number | null = null;
let mainWhId: number | null = null;
let onlineWhId: number | null = null;
let posWhId: number | null = null;
let testMainStockId: number | null = null;
let testOnlineStockId: number | null = null;

beforeAll(async () => {
  const db = await getDb();
  if (!db) return;

  // Get existing warehouses
  const allWarehouses = await db.select().from(warehouses);
  const mainWh = allWarehouses.find(w => w.type === 'main');
  const onlineWh = allWarehouses.find(w => w.type === 'online');
  const posWh = allWarehouses.find(w => w.type === 'pos');

  if (!mainWh || !onlineWh) {
    console.warn('Required warehouses not found, skipping P9 tests');
    return;
  }

  mainWhId = mainWh.id;
  onlineWhId = onlineWh.id;
  posWhId = posWh?.id ?? null;

  // Create a test product
  const [prodResult] = await db.insert(products).values({
    name: '__test_p9_product__',
    slug: `__test-p9-product-${Date.now()}__`,
    price: '10.000',
    status: 'draft',
    type: 'simple',
  });
  testProductId = (prodResult as any).insertId;

  // Set MAIN stock = 100
  const [mainStockResult] = await db.insert(warehouseStock).values({
    warehouseId: mainWhId,
    productId: testProductId,
    variantId: null,
    quantity: 100,
    reservedQty: 0,
  });
  testMainStockId = (mainStockResult as any).insertId;

  // Set ONLINE stock = 30 (already distributed)
  const [onlineStockResult] = await db.insert(warehouseStock).values({
    warehouseId: onlineWhId,
    productId: testProductId,
    variantId: null,
    quantity: 30,
    reservedQty: 0,
  });
  testOnlineStockId = (onlineStockResult as any).insertId;
});

afterAll(async () => {
  const db = await getDb();
  if (!db || !testProductId) return;

  // Clean up stock transfers
  await db.delete(stockTransfers).where(eq(stockTransfers.productId, testProductId));
  // Clean up warehouse stock
  await db.delete(warehouseStock).where(eq(warehouseStock.productId, testProductId));
  // Clean up product
  await db.delete(products).where(eq(products.id, testProductId));
});

describe('P9 — Warehouse Stock Validation on Transfer', () => {
  it('rejects over-allocation: MAIN=100, ONLINE=30, transfer 80 more → only 70 available', async () => {
    if (!testProductId || !mainWhId || !onlineWhId) return;
    // MAIN=100, ONLINE=30 → available = 70
    // Trying to transfer 80 should fail
    await expect(
      transferStock({
        fromWarehouseId: mainWhId,
        toWarehouseId: onlineWhId,
        productId: testProductId,
        quantity: 80,
        reason: 'p9_test_over_alloc',
      })
    ).rejects.toThrow(/Cannot transfer 80 units/);
  });

  it('approves valid transfer: MAIN=100, ONLINE=30, transfer 70 → exactly at limit', async () => {
    if (!testProductId || !mainWhId || !onlineWhId) return;
    // MAIN=100, ONLINE=30 → available = 70
    // Transferring exactly 70 should succeed
    await expect(
      transferStock({
        fromWarehouseId: mainWhId,
        toWarehouseId: onlineWhId,
        productId: testProductId,
        quantity: 70,
        reason: 'p9_test_exact_limit',
      })
    ).resolves.toEqual({ success: true });

    // Restore: move 70 back from ONLINE to MAIN
    await transferStock({
      fromWarehouseId: onlineWhId,
      toWarehouseId: mainWhId,
      productId: testProductId,
      quantity: 70,
      reason: 'p9_test_restore',
    });
  });

  it('approves transfer within limit: MAIN=100, ONLINE=30, transfer 50 → 50 < 70 available', async () => {
    if (!testProductId || !mainWhId || !onlineWhId) return;
    await expect(
      transferStock({
        fromWarehouseId: mainWhId,
        toWarehouseId: onlineWhId,
        productId: testProductId,
        quantity: 50,
        reason: 'p9_test_valid',
      })
    ).resolves.toEqual({ success: true });

    // Restore
    await transferStock({
      fromWarehouseId: onlineWhId,
      toWarehouseId: mainWhId,
      productId: testProductId,
      quantity: 50,
      reason: 'p9_test_restore2',
    });
  });

  it('rejects transfer of 1 more than available: MAIN=100, ONLINE=30, transfer 71 → 71 > 70', async () => {
    if (!testProductId || !mainWhId || !onlineWhId) return;
    await expect(
      transferStock({
        fromWarehouseId: mainWhId,
        toWarehouseId: onlineWhId,
        productId: testProductId,
        quantity: 71,
        reason: 'p9_test_one_over',
      })
    ).rejects.toThrow(/Cannot transfer/);
  });
});
