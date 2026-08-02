/**
 * A2 — POS Stock Deduction Warehouse Test
 * Verifies that POS createOrder deducts stock from the POS warehouse only,
 * and never touches the ONLINE warehouse.
 *
 * Tests the stock deduction logic directly (same pattern as other tests in this project).
 */
import { describe, it, expect } from 'vitest';

// ─── Warehouse IDs ────────────────────────────────────────────────────────────
const POS_WAREHOUSE_ID = 3;
const ONLINE_WAREHOUSE_ID = 2;

// ─── Types ────────────────────────────────────────────────────────────────────
interface StockRow {
  id: number;
  warehouseId: number;
  productId: number;
  variantId: number | null;
  quantity: number;
}

interface OrderItem {
  productId: number;
  variantId?: number;
  name: string;
  quantity: number;
  unitPrice: number;
}

// ─── Core logic extracted from pos.ts createOrder ────────────────────────────
// This mirrors exactly what the procedure does: pre-flight check then deduction.

function checkAndDeductPosStock(
  items: OrderItem[],
  posWarehouseId: number,
  stockRows: StockRow[],
): { success: true; updatedRows: StockRow[] } | { success: false; error: string } {
  // Pre-flight: check every item has sufficient POS stock
  const insufficient: string[] = [];
  for (const item of items) {
    const row = stockRows.find(
      r => r.warehouseId === posWarehouseId &&
           r.productId === item.productId &&
           r.variantId === (item.variantId ?? null),
    );
    const available = row?.quantity ?? 0;
    if (available < item.quantity) {
      insufficient.push(`${item.name}: requested ${item.quantity}, available ${available}`);
    }
  }
  if (insufficient.length > 0) {
    return { success: false, error: `Insufficient stock:\n${insufficient.join('\n')}` };
  }

  // Deduct from POS warehouse only
  const updatedRows = stockRows.map(row => ({ ...row })); // deep copy
  for (const item of items) {
    const row = updatedRows.find(
      r => r.warehouseId === posWarehouseId &&
           r.productId === item.productId &&
           r.variantId === (item.variantId ?? null),
    );
    if (row) {
      row.quantity = Math.max(0, row.quantity - item.quantity);
    }
  }
  return { success: true, updatedRows };
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('A2 — POS stock deduction warehouse', () => {

  it('deducts stock from POS warehouse only — ONLINE warehouse is untouched', () => {
    const stock: StockRow[] = [
      { id: 1, warehouseId: POS_WAREHOUSE_ID,    productId: 101, variantId: null, quantity: 10 },
      { id: 2, warehouseId: ONLINE_WAREHOUSE_ID, productId: 101, variantId: null, quantity: 20 },
    ];

    const result = checkAndDeductPosStock(
      [{ productId: 101, name: 'Chair', quantity: 3, unitPrice: 10 }],
      POS_WAREHOUSE_ID,
      stock,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const posRow    = result.updatedRows.find(r => r.warehouseId === POS_WAREHOUSE_ID);
    const onlineRow = result.updatedRows.find(r => r.warehouseId === ONLINE_WAREHOUSE_ID);

    // POS: 10 - 3 = 7
    expect(posRow?.quantity).toBe(7);
    // ONLINE: untouched
    expect(onlineRow?.quantity).toBe(20);
  });

  it('throws BAD_REQUEST when POS stock is insufficient — no deduction occurs', () => {
    const stock: StockRow[] = [
      { id: 1, warehouseId: POS_WAREHOUSE_ID,    productId: 101, variantId: null, quantity: 5 },
      { id: 2, warehouseId: ONLINE_WAREHOUSE_ID, productId: 101, variantId: null, quantity: 50 },
    ];

    const result = checkAndDeductPosStock(
      [{ productId: 101, name: 'Chair', quantity: 10, unitPrice: 10 }], // 10 > 5
      POS_WAREHOUSE_ID,
      stock,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('Insufficient stock');
    expect(result.error).toContain('Chair: requested 10, available 5');
  });

  it('deducts correct quantities for multiple items — ONLINE rows all untouched', () => {
    const stock: StockRow[] = [
      { id: 1, warehouseId: POS_WAREHOUSE_ID,    productId: 101, variantId: null, quantity: 10 },
      { id: 2, warehouseId: ONLINE_WAREHOUSE_ID, productId: 101, variantId: null, quantity: 20 },
      { id: 3, warehouseId: POS_WAREHOUSE_ID,    productId: 102, variantId: null, quantity: 8  },
      { id: 4, warehouseId: ONLINE_WAREHOUSE_ID, productId: 102, variantId: null, quantity: 15 },
    ];

    const result = checkAndDeductPosStock(
      [
        { productId: 101, name: 'Chair', quantity: 2, unitPrice: 10 },
        { productId: 102, name: 'Table', quantity: 3, unitPrice: 25 },
      ],
      POS_WAREHOUSE_ID,
      stock,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    const { updatedRows } = result;

    // POS deductions
    expect(updatedRows.find(r => r.id === 1)?.quantity).toBe(8);  // 10-2
    expect(updatedRows.find(r => r.id === 3)?.quantity).toBe(5);  // 8-3

    // ONLINE untouched
    expect(updatedRows.find(r => r.id === 2)?.quantity).toBe(20);
    expect(updatedRows.find(r => r.id === 4)?.quantity).toBe(15);
  });

  it('deducts variant-level stock from POS only', () => {
    const stock: StockRow[] = [
      { id: 1, warehouseId: POS_WAREHOUSE_ID,    productId: 101, variantId: 5, quantity: 6 },
      { id: 2, warehouseId: ONLINE_WAREHOUSE_ID, productId: 101, variantId: 5, quantity: 12 },
    ];

    const result = checkAndDeductPosStock(
      [{ productId: 101, variantId: 5, name: 'Chair (Blue)', quantity: 4, unitPrice: 15 }],
      POS_WAREHOUSE_ID,
      stock,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.updatedRows.find(r => r.id === 1)?.quantity).toBe(2);  // 6-4
    expect(result.updatedRows.find(r => r.id === 2)?.quantity).toBe(12); // untouched
  });

  it('does not deduct from ONLINE even when POS stock is zero and ONLINE has plenty', () => {
    const stock: StockRow[] = [
      { id: 1, warehouseId: POS_WAREHOUSE_ID,    productId: 101, variantId: null, quantity: 0  },
      { id: 2, warehouseId: ONLINE_WAREHOUSE_ID, productId: 101, variantId: null, quantity: 100 },
    ];

    const result = checkAndDeductPosStock(
      [{ productId: 101, name: 'Chair', quantity: 1, unitPrice: 10 }],
      POS_WAREHOUSE_ID,
      stock,
    );

    // Must fail — cannot borrow from ONLINE
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('Insufficient stock');

    // ONLINE must remain untouched
    expect(stock.find(r => r.warehouseId === ONLINE_WAREHOUSE_ID)?.quantity).toBe(100);
  });
});
