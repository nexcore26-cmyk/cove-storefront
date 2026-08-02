/**
 * Bundle stock logic unit tests — Phase 21
 *
 * Tests cover the core bundle stock computation helpers that mirror the
 * logic used in bundles.checkStock and products.bySlug (server-side).
 * We test pure functions here to avoid needing a live DB connection.
 */

import { describe, it, expect } from "vitest";

// ─── Pure helpers (mirroring server logic) ────────────────────────────────────

/**
 * Compute the effective stock of a bundle variant.
 * effectiveStock = min(floor(componentStock / qty)) across all components.
 * Returns null when no components are configured.
 * Returns 0 when any component has 0 stock.
 */
function computeBundleEffectiveStock(
  components: Array<{ qty: number; stock: number }>
): number | null {
  if (components.length === 0) return null;
  const availableUnits = components.map((c) =>
    c.qty > 0 ? Math.floor(c.stock / c.qty) : 0
  );
  return Math.min(...availableUnits);
}

/**
 * Compute how much stock to deduct from each component when a bundle is ordered.
 * Returns a map of componentVariantId → qty to deduct.
 */
function computeBundleDeductions(
  components: Array<{ componentVariantId: number; qty: number }>,
  orderedQuantity: number
): Record<number, number> {
  const deductions: Record<number, number> = {};
  for (const comp of components) {
    const totalDeduction = comp.qty * orderedQuantity;
    deductions[comp.componentVariantId] = Math.ceil(totalDeduction);
  }
  return deductions;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("computeBundleEffectiveStock", () => {
  it("returns null when no components are configured", () => {
    expect(computeBundleEffectiveStock([])).toBeNull();
  });

  it("returns the component stock when there is only one component with qty=1", () => {
    expect(computeBundleEffectiveStock([{ qty: 1, stock: 5 }])).toBe(5);
  });

  it("returns the minimum available units across all components", () => {
    // Component A: 10 stock, qty 2 → 5 bundles
    // Component B: 3 stock, qty 1 → 3 bundles
    // Effective = min(5, 3) = 3
    expect(
      computeBundleEffectiveStock([
        { qty: 2, stock: 10 },
        { qty: 1, stock: 3 },
      ])
    ).toBe(3);
  });

  it("returns 0 when any component is out of stock", () => {
    expect(
      computeBundleEffectiveStock([
        { qty: 1, stock: 5 },
        { qty: 1, stock: 0 },
      ])
    ).toBe(0);
  });

  it("floors fractional available units", () => {
    // Component: 5 stock, qty 2 → floor(5/2) = 2
    expect(computeBundleEffectiveStock([{ qty: 2, stock: 5 }])).toBe(2);
  });

  it("handles qty > stock (returns 0)", () => {
    // Component: 1 stock, qty 3 → floor(1/3) = 0
    expect(computeBundleEffectiveStock([{ qty: 3, stock: 1 }])).toBe(0);
  });

  it("handles multiple components where the bottleneck is the last one", () => {
    // A: 100 stock, qty 1 → 100
    // B: 100 stock, qty 1 → 100
    // C: 2 stock, qty 1 → 2
    expect(
      computeBundleEffectiveStock([
        { qty: 1, stock: 100 },
        { qty: 1, stock: 100 },
        { qty: 1, stock: 2 },
      ])
    ).toBe(2);
  });
});

describe("computeBundleDeductions", () => {
  it("deducts qty × orderedQuantity for each component", () => {
    const deductions = computeBundleDeductions(
      [
        { componentVariantId: 10, qty: 2 },
        { componentVariantId: 20, qty: 1 },
      ],
      3 // ordered 3 bundles
    );
    expect(deductions[10]).toBe(6); // 2 × 3
    expect(deductions[20]).toBe(3); // 1 × 3
  });

  it("returns empty object for empty components", () => {
    expect(computeBundleDeductions([], 5)).toEqual({});
  });

  it("ceils fractional deductions", () => {
    // qty=1.5, ordered=2 → 3 (exact)
    const deductions = computeBundleDeductions(
      [{ componentVariantId: 1, qty: 1.5 }],
      2
    );
    expect(deductions[1]).toBe(3);
  });

  it("handles ordered quantity of 1", () => {
    const deductions = computeBundleDeductions(
      [{ componentVariantId: 5, qty: 3 }],
      1
    );
    expect(deductions[5]).toBe(3);
  });
});
