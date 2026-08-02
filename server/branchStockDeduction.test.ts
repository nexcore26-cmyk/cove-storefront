/**
 * Branch-scoped stock deduction test.
 * Verifies that each POS branch deducts from its own dedicated warehouse only,
 * and that a sale at one branch never touches another branch's stock — the
 * exact cross-tenant/cross-branch landmine identified before this feature shipped.
 *
 * Tests the logic directly (same pattern as posStockDeduction.test.ts).
 */
import { describe, it, expect } from 'vitest';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Branch {
  id: number;
  isActive: boolean;
  warehouseId: number;
}

interface Warehouse {
  id: number;
  isActive: boolean;
}

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

// ─── Logic extracted from server/db.ts resolveWarehouseIdForBranch ──────────
function resolveWarehouseIdForBranch(
  branchId: number | null | undefined,
  branches: Branch[],
  warehouses: Warehouse[],
): number | null {
  if (!branchId) return null;
  const branch = branches.find(b => b.id === branchId && b.isActive);
  if (!branch) return null;
  const warehouse = warehouses.find(w => w.id === branch.warehouseId && w.isActive);
  return warehouse?.id ?? null;
}

// ─── Logic extracted from server/routers/pos.ts createOrder ────────────────
function checkAndDeductBranchStock(
  items: OrderItem[],
  warehouseId: number | null,
  stockRows: StockRow[],
): { success: true; updatedRows: StockRow[] } | { success: false; error: string } {
  if (!warehouseId) {
    return { success: false, error: 'No active branch selected for this POS session. Please select a branch and try again.' };
  }

  const insufficient: string[] = [];
  for (const item of items) {
    const row = stockRows.find(
      r => r.warehouseId === warehouseId &&
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

  const updatedRows = stockRows.map(row => ({ ...row }));
  for (const item of items) {
    const row = updatedRows.find(
      r => r.warehouseId === warehouseId &&
           r.productId === item.productId &&
           r.variantId === (item.variantId ?? null),
    );
    if (row) row.quantity = Math.max(0, row.quantity - item.quantity);
  }
  return { success: true, updatedRows };
}

// ─── Fixtures: two branches, each with their own warehouse ──────────────────
const BRASS_BRANCH: Branch = { id: 1, isActive: true, warehouseId: 3 };
const SECOND_BRANCH: Branch = { id: 2, isActive: true, warehouseId: 4 };
const BRANCHES = [BRASS_BRANCH, SECOND_BRANCH];
const WAREHOUSES: Warehouse[] = [
  { id: 3, isActive: true }, // Brass Store warehouse
  { id: 4, isActive: true }, // Second branch warehouse
];

describe('Branch-scoped stock resolution', () => {
  it('resolves a branch to its own dedicated warehouse', () => {
    expect(resolveWarehouseIdForBranch(1, BRANCHES, WAREHOUSES)).toBe(3);
    expect(resolveWarehouseIdForBranch(2, BRANCHES, WAREHOUSES)).toBe(4);
  });

  it('returns null when no branch is selected', () => {
    expect(resolveWarehouseIdForBranch(null, BRANCHES, WAREHOUSES)).toBeNull();
    expect(resolveWarehouseIdForBranch(undefined, BRANCHES, WAREHOUSES)).toBeNull();
  });

  it('returns null for an inactive branch', () => {
    const branches = [{ ...BRASS_BRANCH, isActive: false }, SECOND_BRANCH];
    expect(resolveWarehouseIdForBranch(1, branches, WAREHOUSES)).toBeNull();
  });

  it('returns null when the branch\'s warehouse is inactive', () => {
    const warehouses = [{ id: 3, isActive: false }, { id: 4, isActive: true }];
    expect(resolveWarehouseIdForBranch(1, BRANCHES, warehouses)).toBeNull();
  });

  it('returns null for a nonexistent branch id', () => {
    expect(resolveWarehouseIdForBranch(999, BRANCHES, WAREHOUSES)).toBeNull();
  });
});

describe('Branch-scoped POS stock deduction — the cross-branch landmine', () => {
  it('a sale at Branch 1 deducts only Branch 1\'s warehouse — Branch 2 is completely untouched', () => {
    const stock: StockRow[] = [
      { id: 1, warehouseId: 3, productId: 101, variantId: null, quantity: 10 }, // Branch 1 stock
      { id: 2, warehouseId: 4, productId: 101, variantId: null, quantity: 10 }, // Branch 2 stock — same product
    ];

    const warehouseId = resolveWarehouseIdForBranch(BRASS_BRANCH.id, BRANCHES, WAREHOUSES);
    const result = checkAndDeductBranchStock(
      [{ productId: 101, name: 'Chair', quantity: 4, unitPrice: 10 }],
      warehouseId,
      stock,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    // Branch 1: 10 - 4 = 6
    expect(result.updatedRows.find(r => r.id === 1)?.quantity).toBe(6);
    // Branch 2: completely untouched, still 10 — this is the bug the audit flagged
    expect(result.updatedRows.find(r => r.id === 2)?.quantity).toBe(10);
  });

  it('a sale at Branch 2 never touches Branch 1\'s stock, even with identical product/quantity', () => {
    const stock: StockRow[] = [
      { id: 1, warehouseId: 3, productId: 101, variantId: null, quantity: 5 },
      { id: 2, warehouseId: 4, productId: 101, variantId: null, quantity: 5 },
    ];

    const warehouseId = resolveWarehouseIdForBranch(SECOND_BRANCH.id, BRANCHES, WAREHOUSES);
    const result = checkAndDeductBranchStock(
      [{ productId: 101, name: 'Chair', quantity: 5, unitPrice: 10 }],
      warehouseId,
      stock,
    );

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.updatedRows.find(r => r.id === 2)?.quantity).toBe(0);  // Branch 2 depleted
    expect(result.updatedRows.find(r => r.id === 1)?.quantity).toBe(5);  // Branch 1 untouched
  });

  it('rejects the order when no active branch is selected — never falls back to a shared/global warehouse', () => {
    const stock: StockRow[] = [
      { id: 1, warehouseId: 3, productId: 101, variantId: null, quantity: 10 },
    ];
    const result = checkAndDeductBranchStock(
      [{ productId: 101, name: 'Chair', quantity: 1, unitPrice: 10 }],
      null, // no active branch resolved
      stock,
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('No active branch selected');
  });

  it('insufficient stock at Branch 1 fails even though Branch 2 has plenty — no cross-branch borrowing', () => {
    const stock: StockRow[] = [
      { id: 1, warehouseId: 3, productId: 101, variantId: null, quantity: 2 },
      { id: 2, warehouseId: 4, productId: 101, variantId: null, quantity: 100 },
    ];

    const warehouseId = resolveWarehouseIdForBranch(BRASS_BRANCH.id, BRANCHES, WAREHOUSES);
    const result = checkAndDeductBranchStock(
      [{ productId: 101, name: 'Chair', quantity: 5, unitPrice: 10 }],
      warehouseId,
      stock,
    );

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error).toContain('Insufficient stock');
    // Branch 2's stock must remain completely untouched
    expect(stock.find(r => r.id === 2)?.quantity).toBe(100);
  });
});
